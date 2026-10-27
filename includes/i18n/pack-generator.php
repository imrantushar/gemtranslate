<?php
namespace Zentranslate\I18n;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\AI\Glossary;
use Zentranslate\AI\TranslationMemory;
use Zentranslate\AI\TranslatorFactory;
use Zentranslate\Language\Context;
use Zentranslate\Translation\StringTranslator;

/**
 * Generates language packs (PO + MO + per-script JSON) using the configured
 * AI translator.
 *
 * Two modes:
 *   - Legacy mode (`$opts['domain']` unset) — reads `languages/zentranslate.pot`,
 *     translates with AI, writes `zentranslate-{locale}.po/mo/json` next to
 *     the .pot. Kept for the WP-CLI / programmatic path that used to back the
 *     "Plugin translations" admin page.
 *
 *   - Per-domain mode (`$opts['domain']` set) — pulls entries from our
 *     `wp_ztrans_strings` table for the given text-domain, uses any existing
 *     translations from `wp_ztrans_string_translations` first, falls back to
 *     AI for anything still untranslated, and writes the resulting files into
 *     `wp-content/languages/plugins/{domain}-{locale}.po/mo` — the canonical
 *     location WordPress auto-loads via `load_plugin_textdomain()`.
 *
 * `$opts['exclude_status']` skips rows with the given status when emitting the
 * PO. Used by the "Export PO for WordPress.org" variant to drop `wp_org` rows
 * (so we don't redundantly contribute community translations back).
 */
class PackGenerator {

	const BATCH_SIZE = 25;

	public static function languages_dir() {
		return trailingslashit( ZTRANS_ROOT_DIR_PATH . 'languages' );
	}

	public static function pot_path() {
		return self::languages_dir() . 'zentranslate.pot';
	}

	/**
	 * Output directory for per-domain plugin packs. Resolves to
	 * `wp-content/languages/plugins/` by default.
	 */
	public static function plugins_languages_dir() {
		return trailingslashit( WP_LANG_DIR ) . 'plugins/';
	}

	/**
	 * Return the existing packs, indexed by locale.
	 */
	public static function status() {
		$dir   = self::languages_dir();
		$out   = [];
		if ( ! is_dir( $dir ) ) {
			return $out;
		}
		foreach ( glob( $dir . 'zentranslate-*.po' ) as $po ) {
			$base   = basename( $po, '.po' );
			$locale = substr( $base, strlen( 'zentranslate-' ) );
			$mo     = $dir . 'zentranslate-' . $locale . '.mo';
			$jsons  = glob( $dir . 'zentranslate-' . $locale . '-*.json' );
			$out[ $locale ] = [
				'locale'    => $locale,
				'po'        => file_exists( $po ),
				'mo'        => file_exists( $mo ),
				'json'      => count( $jsons ),
				'po_mtime'  => file_exists( $po ) ? filemtime( $po ) : 0,
				'po_size'   => file_exists( $po ) ? filesize( $po ) : 0,
			];
		}
		return $out;
	}

	/**
	 * Generate (or refresh) a language pack for the given locale.
	 *
	 * In per-domain mode, the entry list comes from `wp_ztrans_strings` and
	 * any user-supplied translations already in `wp_ztrans_string_translations`
	 * are used verbatim — AI fill is reserved for whatever is still missing
	 * AND when `$opts['ai_fill']` is true (default true).
	 *
	 * @param string $target_lang Target language code (e.g. 'es').
	 * @param string $locale      WP locale (e.g. 'es_ES'). Used in output filenames.
	 * @param array  $opts        domain, ai_fill, exclude_status, target_lang_label.
	 * @return array{written:int,total:int,locale:string,paths:array}|\WP_Error
	 */
	public static function generate( $target_lang, $locale, array $opts = [] ) {
		$domain         = (string) ( $opts['domain'] ?? '' );
		$ai_fill        = (bool) ( $opts['ai_fill'] ?? true );
		$exclude_status = (string) ( $opts['exclude_status'] ?? '' );

		if ( '' === $domain ) {
			return self::generate_legacy_zentranslate_pack( $target_lang, $locale, $ai_fill );
		}
		return self::generate_for_domain( $target_lang, $locale, $domain, $ai_fill, $exclude_status );
	}

	/**
	 * Legacy path: read zentranslate.pot, AI-translate, write packs into the
	 * plugin's own `languages/` folder. One existing caller — the WP-CLI
	 * commands. The "Plugin translations" admin page is being removed in v1.4.
	 */
	private static function generate_legacy_zentranslate_pack( $target_lang, $locale, $ai_fill ) {
		$pot = self::pot_path();
		if ( ! file_exists( $pot ) ) {
			return new \WP_Error( 'ztrans_no_pot', __( 'languages/zentranslate.pot is missing. Run `wp i18n make-pot` first.', 'zentranslate' ) );
		}

		$translator = $ai_fill ? TranslatorFactory::default_translator() : null;
		if ( $ai_fill && ! $translator ) {
			return new \WP_Error( 'ztrans_no_provider', __( 'Configure an AI provider before generating packs.', 'zentranslate' ) );
		}

		$entries = PotParser::parse_file( $pot );
		if ( empty( $entries ) ) {
			return new \WP_Error( 'ztrans_empty_pot', __( 'POT file has no translatable strings.', 'zentranslate' ) );
		}

		$source_lang = Context::default_code();
		$translations = self::translate_entries( $entries, $source_lang, $target_lang, $translator );

		$out_entries = [];
		foreach ( $entries as $i => $e ) {
			$out_entries[] = [
				'msgid'      => $e['msgid'],
				'msgstr'     => (string) ( $translations[ $i ] ?? '' ),
				'context'    => (string) $e['context'],
				'references' => $e['references'],
			];
		}

		$dir     = self::languages_dir();
		$po_path = $dir . 'zentranslate-' . $locale . '.po';
		$mo_path = $dir . 'zentranslate-' . $locale . '.mo';

		self::write_po( $out_entries, $po_path, $locale );
		MoWriter::write( $out_entries, $mo_path );
		$json_paths = self::write_json( $out_entries, $dir, $locale );

		$written = count( array_filter( $translations, fn( $v ) => '' !== $v ) );
		return [
			'written' => $written,
			'total'   => count( $entries ),
			'locale'  => $locale,
			'paths'   => array_merge( [ $po_path, $mo_path ], $json_paths ),
		];
	}

	/**
	 * Per-domain path: pull entries from `wp_ztrans_strings` + their
	 * translations, optionally AI-fill the gaps, write to
	 * `wp-content/languages/plugins/{domain}-{locale}.po/mo`. WordPress
	 * auto-loads these via `load_plugin_textdomain()`.
	 */
	private static function generate_for_domain( $target_lang, $locale, $domain, $ai_fill, $exclude_status ) {
		$listing = StringTranslator::list_strings( [
			'domain'   => $domain,
			'lang'     => $target_lang,
			'page'     => 1,
			'per_page' => 10000,
		] );
		$rows = $listing['rows'] ?? [];
		if ( empty( $rows ) ) {
			return new \WP_Error(
				'ztrans_empty_domain',
				sprintf(
					/* translators: %s: text domain. */
					__( 'No strings registered for domain "%s". Run a scan first.', 'zentranslate' ),
					$domain
				)
			);
		}

		$source_lang = Context::default_code();

		// Build entries from our table; preserve existing translations,
		// queue AI fill for genuinely empty ones (if enabled).
		$entries        = [];
		$pending_idx    = [];
		$pending_texts  = [];
		foreach ( $rows as $i => $row ) {
			$existing = (string) ( $row['translation'] ?? '' );
			$status   = (string) ( $row['translation_status'] ?? '' );
			$entries[ $i ] = [
				'msgid'      => (string) $row['source'],
				'msgstr'     => $existing,
				'context'    => (string) ( $row['context'] ?? '' ),
				'references' => '' !== ( $row['file_ref'] ?? '' ) ? [ (string) $row['file_ref'] ] : [],
				'_status'    => $status,
			];
			if ( '' === $existing && $ai_fill ) {
				$pending_idx[ $i ]   = (int) $row['string_id'];
				$pending_texts[ $i ] = (string) $row['source'];
			}
		}

		$translator = $ai_fill ? TranslatorFactory::default_translator() : null;
		if ( $ai_fill && $translator && ! empty( $pending_texts ) ) {
			$ai_results = self::translate_entries( $pending_texts, $source_lang, $target_lang, $translator );
			foreach ( $ai_results as $i => $value ) {
				if ( '' === (string) $value || ! isset( $entries[ $i ] ) ) {
					continue;
				}
				$entries[ $i ]['msgstr'] = (string) $value;
				// Persist back to our table as draft so the admin can review.
				if ( isset( $pending_idx[ $i ] ) ) {
					StringTranslator::save_translation( $pending_idx[ $i ], $target_lang, (string) $value, 'draft' );
				}
			}
		}

		// Optionally skip rows by status (e.g. 'wp_org' for WP.org export).
		$out_entries = [];
		foreach ( $entries as $e ) {
			if ( '' !== $exclude_status && ( $e['_status'] ?? '' ) === $exclude_status ) {
				continue;
			}
			unset( $e['_status'] );
			$out_entries[] = $e;
		}

		$dir = self::plugins_languages_dir();
		if ( ! wp_mkdir_p( $dir ) ) {
			return new \WP_Error( 'ztrans_mkdir_failed', __( 'Could not create wp-content/languages/plugins/ directory.', 'zentranslate' ) );
		}
		$po_path = $dir . $domain . '-' . $locale . '.po';
		$mo_path = $dir . $domain . '-' . $locale . '.mo';

		self::write_po( $out_entries, $po_path, $locale );
		MoWriter::write( $out_entries, $mo_path );

		$written = 0;
		foreach ( $out_entries as $e ) {
			if ( '' !== (string) ( $e['msgstr'] ?? '' ) ) {
				$written++;
			}
		}

		return [
			'written' => $written,
			'total'   => count( $out_entries ),
			'locale'  => $locale,
			'domain'  => $domain,
			'paths'   => [ $po_path, $mo_path ],
		];
	}

	/**
	 * Translate a list of msgids through TranslationMemory + the AI translator
	 * in batches. Used by both the legacy and per-domain paths.
	 *
	 * @param array  $entries    Either POT-parser entries (with 'msgid' key) OR a flat
	 *                           map of index => msgid string. Both shapes accepted so
	 *                           the legacy and per-domain callers can share this.
	 * @return array Index-aligned map of translated strings.
	 */
	private static function translate_entries( array $entries, $source_lang, $target_lang, $translator ) {
		// TM + Glossary are Pro; degrade gracefully if unavailable.
		$has_tm       = class_exists( TranslationMemory::class );
		$glossary     = class_exists( Glossary::class )
			? Glossary::build_context( $source_lang, $target_lang )
			: [ 'pairs' => [] ];

		$translations = [];
		$pending      = [];
		foreach ( $entries as $i => $e ) {
			$msgid  = is_array( $e ) ? (string) ( $e['msgid'] ?? '' ) : (string) $e;
			$cached = $has_tm ? TranslationMemory::get( $msgid, $source_lang, $target_lang ) : null;
			if ( null !== $cached ) {
				$translations[ $i ] = $cached;
			} else {
				$pending[ $i ] = $msgid;
			}
		}

		if ( ! $translator || empty( $pending ) ) {
			return $translations;
		}

		foreach ( array_chunk( $pending, self::BATCH_SIZE, true ) as $chunk ) {
			$indexes = array_keys( $chunk );
			$texts   = array_values( $chunk );

			$result = $translator->translate(
				$texts,
				$source_lang,
				$target_lang,
				[ 'preserve_html' => false, 'glossary' => $glossary['pairs'] ]
			);
			if ( is_wp_error( $result ) ) {
				return $translations;
			}
			foreach ( $indexes as $j => $orig_index ) {
				$value = $result['translations'][ $j ] ?? '';
				$translations[ $orig_index ] = $value;
				if ( '' !== $value && $has_tm ) {
					TranslationMemory::set( $texts[ $j ], $value, $source_lang, $target_lang, $result['provider'] ?? '' );
				}
			}
		}
		return $translations;
	}

	public static function delete( $locale ) {
		$dir = self::languages_dir();
		$pattern = 'zentranslate-' . $locale;
		$removed = 0;
		foreach ( glob( $dir . $pattern . '*' ) as $path ) {
			if ( @unlink( $path ) ) {
				$removed++;
			}
		}
		return $removed;
	}

	private static function write_po( array $entries, $path, $locale ) {
		$lines = [];
		$lines[] = 'msgid ""';
		$lines[] = 'msgstr ""';
		$lines[] = '"Content-Type: text/plain; charset=UTF-8\\n"';
		$lines[] = '"Language: ' . PotParser::escape( $locale ) . '\\n"';
		$lines[] = '"X-Generator: Zentranslate AI Pack Generator\\n"';
		$lines[] = '';

		foreach ( $entries as $e ) {
			foreach ( $e['references'] as $ref ) {
				$lines[] = '#: ' . $ref;
			}
			if ( '' !== $e['context'] ) {
				$lines[] = 'msgctxt "' . PotParser::escape( $e['context'] ) . '"';
			}
			$lines[] = 'msgid "' . PotParser::escape( $e['msgid'] ) . '"';
			$lines[] = 'msgstr "' . PotParser::escape( $e['msgstr'] ) . '"';
			$lines[] = '';
		}
		file_put_contents( $path, implode( "\n", $lines ) );
	}

	private static function write_json( array $entries, $dir, $locale ) {
		// We write a "language-pack-style" JSON-ed messages bag keyed by msgid.
		// WordPress's runtime looks for `zentranslate-{locale}-{md5(path)}.json`
		// per script. Since we don't know which JS file each string came from,
		// we write to the canonical handle used by our admin script.
		$handle    = 'zentranslate-backend'; // matches wp_enqueue_script handle
		$file_name = sprintf( 'zentranslate-%s-%s.json', $locale, md5( 'assets/build/backend.' . ZTRANS_VERSION . '.js' ) );
		$messages  = [];
		foreach ( $entries as $e ) {
			if ( '' === $e['msgstr'] ) {
				continue;
			}
			$key            = '' !== $e['context'] ? $e['context'] . "\x04" . $e['msgid'] : $e['msgid'];
			$messages[ $key ] = [ $e['msgstr'] ];
		}
		$payload = [
			'translation-revision-date' => gmdate( 'Y-m-d H:i:s+0000' ),
			'generator'                  => 'zentranslate',
			'domain'                     => 'messages',
			'locale_data'                => [
				'messages' => array_merge(
					[ '' => [ 'domain' => 'messages', 'lang' => $locale, 'plural-forms' => 'nplurals=2; plural=(n != 1);' ] ],
					$messages
				),
			],
			'comment'                    => [ 'reference' => $handle ],
		];
		$path = $dir . $file_name;
		file_put_contents( $path, wp_json_encode( $payload, JSON_UNESCAPED_UNICODE ) );
		return [ $path ];
	}
}

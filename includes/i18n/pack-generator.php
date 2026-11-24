<?php
namespace GemTranslate\I18n;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Translation\StringTranslator;

/**
 * Generates language packs (PO + MO + per-script JSON) from whatever
 * translations already exist — no AI translator involved.
 *
 * Two modes:
 *   - Legacy mode (`$opts['domain']` unset) — reads `languages/gemtranslate.pot`,
 *     writes `gemtranslate-{locale}.po/mo/json` next to the .pot. Kept for the
 *     WP-CLI / programmatic path that used to back the "Plugin translations"
 *     admin page.
 *
 *   - Per-domain mode (`$opts['domain']` set) — pulls entries from our
 *     `wp_gtrans_strings` table for the given text-domain, uses any existing
 *     translations from `wp_gtrans_string_translations`, and writes the
 *     resulting files into `wp-content/languages/plugins/{domain}-{locale}.po/mo`
 *     — the canonical location WordPress auto-loads via
 *     `load_plugin_textdomain()`.
 *
 * `$opts['exclude_status']` skips rows with the given status when emitting the
 * PO. Used by the "Export PO for WordPress.org" variant to drop `wp_org` rows
 * (so we don't redundantly contribute community translations back).
 */
class PackGenerator {

	const BATCH_SIZE = 25;

	public static function languages_dir() {
		return trailingslashit( GTRANS_ROOT_DIR_PATH . 'languages' );
	}

	public static function pot_path() {
		return self::languages_dir() . 'gemtranslate.pot';
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
		foreach ( glob( $dir . 'gemtranslate-*.po' ) as $po ) {
			$base   = basename( $po, '.po' );
			$locale = substr( $base, strlen( 'gemtranslate-' ) );
			$mo     = $dir . 'gemtranslate-' . $locale . '.mo';
			$jsons  = glob( $dir . 'gemtranslate-' . $locale . '-*.json' );
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
	 * In per-domain mode, the entry list comes from `wp_gtrans_strings`;
	 * only translations already saved in `wp_gtrans_string_translations` are
	 * emitted — untranslated rows ship with an empty msgstr.
	 *
	 * @param string $target_lang Target language code (e.g. 'es').
	 * @param string $locale      WP locale (e.g. 'es_ES'). Used in output filenames.
	 * @param array  $opts        domain, exclude_status, target_lang_label.
	 * @return array{written:int,total:int,locale:string,paths:array}|\WP_Error
	 */
	public static function generate( $target_lang, $locale, array $opts = [] ) {
		$domain         = (string) ( $opts['domain'] ?? '' );
		$exclude_status = (string) ( $opts['exclude_status'] ?? '' );

		if ( '' === $domain ) {
			return self::generate_legacy_gemtranslate_pack( $target_lang, $locale );
		}
		return self::generate_for_domain( $target_lang, $locale, $domain, $exclude_status );
	}

	/**
	 * Legacy path: read gemtranslate.pot, write packs into the plugin's own
	 * `languages/` folder. One existing caller — the WP-CLI commands. The
	 * "Plugin translations" admin page is being removed in v1.4.
	 */
	private static function generate_legacy_gemtranslate_pack( $target_lang, $locale ) {
		$pot = self::pot_path();
		if ( ! file_exists( $pot ) ) {
			return new \WP_Error( 'gtrans_no_pot', __( 'languages/gemtranslate.pot is missing. Run `wp i18n make-pot` first.', 'gemtranslate' ) );
		}

		$entries = PotParser::parse_file( $pot );
		if ( empty( $entries ) ) {
			return new \WP_Error( 'gtrans_empty_pot', __( 'POT file has no translatable strings.', 'gemtranslate' ) );
		}

		$translations = array_fill( 0, count( $entries ), '' );

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
		$po_path = $dir . 'gemtranslate-' . $locale . '.po';
		$mo_path = $dir . 'gemtranslate-' . $locale . '.mo';

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
	 * Per-domain path: pull entries from `wp_gtrans_strings` + their
	 * translations, write to `wp-content/languages/plugins/{domain}-{locale}.po/mo`.
	 * WordPress auto-loads these via `load_plugin_textdomain()`.
	 */
	private static function generate_for_domain( $target_lang, $locale, $domain, $exclude_status ) {
		$listing = StringTranslator::list_strings( [
			'domain'   => $domain,
			'lang'     => $target_lang,
			'page'     => 1,
			'per_page' => 10000,
		] );
		$rows = $listing['rows'] ?? [];
		if ( empty( $rows ) ) {
			return new \WP_Error(
				'gtrans_empty_domain',
				sprintf(
					/* translators: %s: text domain. */
					__( 'No strings registered for domain "%s". Run a scan first.', 'gemtranslate' ),
					$domain
				)
			);
		}

		// Build entries from our table, preserving existing translations.
		$entries = [];
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
			return new \WP_Error( 'gtrans_mkdir_failed', __( 'Could not create wp-content/languages/plugins/ directory.', 'gemtranslate' ) );
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

	public static function delete( $locale ) {
		$dir = self::languages_dir();
		$pattern = 'gemtranslate-' . $locale;
		$removed = 0;
		foreach ( glob( $dir . $pattern . '*' ) as $path ) {
			wp_delete_file( $path );
			if ( ! file_exists( $path ) ) {
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
		$lines[] = '"X-Generator: GemTranslate AI Pack Generator\\n"';
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
		// WordPress's runtime looks for `gemtranslate-{locale}-{md5(path)}.json`
		// per script. Since we don't know which JS file each string came from,
		// we write to the canonical handle used by our admin script.
		$handle    = 'gemtranslate-backend'; // matches wp_enqueue_script handle
		$file_name = sprintf( 'gemtranslate-%s-%s.json', $locale, md5( 'assets/build/backend.' . GTRANS_VERSION . '.js' ) );
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
			'generator'                  => 'gemtranslate',
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

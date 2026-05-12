<?php
namespace Zentranslate\I18n;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\AI\Glossary;
use Zentranslate\AI\TranslationMemory;
use Zentranslate\AI\TranslatorFactory;
use Zentranslate\Language\Context;

/**
 * Generates a complete language pack for the Zentranslate plugin itself
 * (PO + MO + per-script JSON) using the configured AI translator. Reads
 * the source `.pot`, translates each msgid in batches, writes the files
 * to `languages/`.
 *
 * The result: the WP admin and Zentranslate React UI in the chosen
 * language with zero human translation effort.
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
	 * Generate (or refresh) a language pack for the given locale by
	 * translating every msgid through the configured AI provider.
	 *
	 * @return array{written:int,total:int,locale:string,paths:array}|\WP_Error
	 */
	public static function generate( $target_lang, $locale ) {
		$pot = self::pot_path();
		if ( ! file_exists( $pot ) ) {
			return new \WP_Error( 'ztrans_no_pot', __( 'languages/zentranslate.pot is missing. Run `wp i18n make-pot` first.', 'zentranslate' ) );
		}

		$translator = TranslatorFactory::default_translator();
		if ( ! $translator ) {
			return new \WP_Error( 'ztrans_no_provider', __( 'Configure an AI provider before generating packs.', 'zentranslate' ) );
		}

		$entries = PotParser::parse_file( $pot );
		if ( empty( $entries ) ) {
			return new \WP_Error( 'ztrans_empty_pot', __( 'POT file has no translatable strings.', 'zentranslate' ) );
		}

		$source_lang = Context::default_code();
		$glossary    = Glossary::build_context( $source_lang, $target_lang );

		// Walk in batches; preserve original order.
		$translations = [];
		$pending      = [];
		foreach ( $entries as $i => $e ) {
			$cached = TranslationMemory::get( $e['msgid'], $source_lang, $target_lang );
			if ( null !== $cached ) {
				$translations[ $i ] = $cached;
			} else {
				$pending[ $i ] = $e['msgid'];
			}
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
				return $result;
			}
			foreach ( $indexes as $j => $orig_index ) {
				$value = $result['translations'][ $j ] ?? '';
				$translations[ $orig_index ] = $value;
				if ( '' !== $value ) {
					TranslationMemory::set( $texts[ $j ], $value, $source_lang, $target_lang, $result['provider'] );
				}
			}
		}

		// Assemble PO entries.
		$out_entries = [];
		foreach ( $entries as $i => $e ) {
			$out_entries[] = [
				'msgid'      => $e['msgid'],
				'msgstr'     => (string) ( $translations[ $i ] ?? '' ),
				'context'    => (string) $e['context'],
				'references' => $e['references'],
			];
		}

		$dir       = self::languages_dir();
		$po_path   = $dir . 'zentranslate-' . $locale . '.po';
		$mo_path   = $dir . 'zentranslate-' . $locale . '.mo';

		self::write_po( $out_entries, $po_path, $locale );
		MoWriter::write( $out_entries, $mo_path );

		// JSON files for React. WordPress's `wp_set_script_translations` looks
		// up file pattern: `zentranslate-{locale}-{md5(script-rel-path)}.json`.
		$json_paths = self::write_json( $out_entries, $dir, $locale );

		$written = count( array_filter( $translations, fn( $v ) => '' !== $v ) );
		return [
			'written' => $written,
			'total'   => count( $entries ),
			'locale'  => $locale,
			'paths'   => array_merge( [ $po_path, $mo_path ], $json_paths ),
		];
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

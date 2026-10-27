<?php
namespace GemTranslate\Migration;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\LanguageRegistry;
use GemTranslate\Translation\StringTranslator;

/**
 * TranslatePress importer.
 *
 * TRP stores translated *strings* (front-end UI text) in
 * `wp_trp_dictionary_<locale>_<locale>` tables with `original`/`translated`
 * columns. Importing those into our string-translation tables is the most
 * valuable conversion since TRP doesn't really do post-level translation
 * the same way.
 */
class TranslatePressImporter {

	public static function detect() {
		global $wpdb;
		return (bool) $wpdb->get_var( "SHOW TABLES LIKE '{$wpdb->prefix}trp_dictionary_%'" );
	}

	public static function run() {
		$result = new MigrationResult( 'translatepress' );
		$result->detected = self::detect();
		if ( ! $result->detected ) {
			$result->errors[] = 'TranslatePress tables not found.';
			return $result;
		}

		global $wpdb;
		$registry = new LanguageRegistry();
		$tables   = $wpdb->get_col( "SHOW TABLES LIKE '{$wpdb->prefix}trp_dictionary_%'" );
		if ( ! $tables ) {
			return $result;
		}

		foreach ( $tables as $table ) {
			// Pattern: wp_trp_dictionary_<source-locale>_<target-locale>
			$suffix = substr( $table, strlen( "{$wpdb->prefix}trp_dictionary_" ) );
			$parts  = explode( '_', $suffix );
			if ( count( $parts ) < 4 ) {
				continue;
			}
			$source_locale = $parts[0] . '_' . $parts[1];
			$target_locale = $parts[2] . '_' . $parts[3];
			$target_code   = strtolower( explode( '_', $target_locale )[0] );

			if ( ! $registry->get( $target_code ) ) {
				$registry->insert( [
					'code'        => $target_code,
					'locale'      => $target_locale,
					'name'        => $target_code,
					'native_name' => $target_code,
					'is_rtl'      => 0,
					'active'      => 1,
				] );
				$result->languages++;
			}

			$rows = $wpdb->get_results( "SELECT original, translated FROM $table WHERE translated <> ''", ARRAY_A );
			foreach ( $rows as $row ) {
				$source = (string) $row['original'];
				$value  = (string) $row['translated'];
				if ( '' === $source || '' === $value ) {
					continue;
				}
				$string_id = StringTranslator::register_string( $source, '', '', '' );
				if ( $string_id && StringTranslator::save_translation( $string_id, $target_code, $value ) ) {
					$result->strings++;
				}
			}
		}

		return $result;
	}
}

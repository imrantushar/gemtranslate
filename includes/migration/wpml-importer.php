<?php
namespace Zentranslate\Migration;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\LanguageRegistry;
use Zentranslate\Translation\TranslationLoader;

/**
 * WPML importer.
 *
 * WPML stores translations as separate posts of the same post_type,
 * linked via `icl_translations(trid, element_id, element_type, language_code)`
 * and `icl_languages` (codes + locales).
 *
 * Our model: one source post + N translation rows in
 * `wp_ztrans_post_translations` keyed by (group_id, language_code).
 *
 * Walks `icl_translations`, picks the source row per `trid`, copies title
 * /content/excerpt of every translated post into the source's group.
 */
class WpmlImporter {

	public static function detect() {
		global $wpdb;
		return (bool) $wpdb->get_var( "SHOW TABLES LIKE '{$wpdb->prefix}icl_translations'" );
	}

	public static function run() {
		$result = new MigrationResult( 'wpml' );
		$result->detected = self::detect();
		if ( ! $result->detected ) {
			$result->errors[] = 'WPML tables not found.';
			return $result;
		}

		global $wpdb;
		$registry = new LanguageRegistry();

		// 1) Import languages.
		$lang_rows = $wpdb->get_results( "SELECT code, english_name AS name, default_locale AS locale, active FROM {$wpdb->prefix}icl_languages", ARRAY_A );
		if ( $lang_rows ) {
			foreach ( $lang_rows as $row ) {
				$code = strtolower( $row['code'] );
				if ( $registry->get( $code ) ) {
					continue;
				}
				$registry->insert( [
					'code'        => $code,
					'locale'      => $row['locale'] ?: $code,
					'name'        => $row['name'] ?: $code,
					'native_name' => $row['name'] ?: $code,
					'is_rtl'      => 0,
					'active'      => ! empty( $row['active'] ) ? 1 : 0,
				] );
				$result->languages++;
			}
		}

		// 2) Walk translation groups. WPML uses one `trid` per translation set,
		// `source_language_code = NULL` for the source post.
		$groups = $wpdb->get_results(
			"SELECT trid, element_id, language_code
			 FROM {$wpdb->prefix}icl_translations
			 WHERE element_type LIKE 'post_%' AND source_language_code IS NULL",
			ARRAY_A
		);
		if ( ! $groups ) {
			return $result;
		}

		foreach ( $groups as $g ) {
			$source_post_id = (int) $g['element_id'];
			$trid           = (int) $g['trid'];
			if ( ! get_post( $source_post_id ) ) {
				$result->skipped++;
				continue;
			}
			$group_id = TranslationLoader::ensure_group_for_post( $source_post_id, $g['language_code'] );
			if ( ! $group_id ) {
				$result->errors[] = "Could not create group for post {$source_post_id}";
				continue;
			}

			// Pull every non-source translation row for this trid.
			$translated_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT element_id, language_code FROM {$wpdb->prefix}icl_translations
					 WHERE trid = %d AND element_id <> %d",
					$trid,
					$source_post_id
				),
				ARRAY_A
			);

			foreach ( $translated_rows as $tr ) {
				$translated_post = get_post( (int) $tr['element_id'] );
				if ( ! $translated_post ) {
					continue;
				}
				TranslationLoader::save_translation(
					$source_post_id,
					$tr['language_code'],
					[
						'title'   => $translated_post->post_title,
						'content' => $translated_post->post_content,
						'excerpt' => $translated_post->post_excerpt,
						'slug'    => $translated_post->post_name,
						'status'  => $translated_post->post_status,
					]
				);
				$result->posts++;
			}
		}

		return $result;
	}
}

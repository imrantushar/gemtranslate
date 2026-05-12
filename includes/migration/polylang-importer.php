<?php
namespace Zentranslate\Migration;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\LanguageRegistry;
use Zentranslate\Translation\TranslationLoader;

/**
 * Polylang importer.
 *
 * Polylang stores languages as terms in the `language` taxonomy and post
 * translations as serialized arrays in term-meta `_translations` of the
 * `post_translations` taxonomy (terms named like `pll_<hash>`).
 *
 * A translation group in Polylang is a single term in `post_translations`
 * whose term-meta `_translations` is a serialized array
 * `[ lang_code => post_id, … ]`.
 */
class PolylangImporter {

	public static function detect() {
		return taxonomy_exists( 'language' ) || taxonomy_exists( 'post_translations' );
	}

	public static function run() {
		$result = new MigrationResult( 'polylang' );
		$result->detected = self::detect();
		if ( ! $result->detected ) {
			$result->errors[] = 'Polylang taxonomies not found.';
			return $result;
		}

		$registry = new LanguageRegistry();

		// 1) Languages — Polylang stores name + locale in term description.
		if ( taxonomy_exists( 'language' ) ) {
			$lang_terms = get_terms( [ 'taxonomy' => 'language', 'hide_empty' => false ] );
			if ( ! is_wp_error( $lang_terms ) ) {
				foreach ( $lang_terms as $t ) {
					$desc   = maybe_unserialize( $t->description );
					$locale = is_array( $desc ) ? ( $desc['locale'] ?? '' ) : '';
					$code   = strtolower( $t->slug );
					if ( $registry->get( $code ) ) {
						continue;
					}
					$registry->insert( [
						'code'        => $code,
						'locale'      => $locale ?: $code,
						'name'        => $t->name,
						'native_name' => $t->name,
						'is_rtl'      => is_array( $desc ) && ! empty( $desc['rtl'] ) ? 1 : 0,
						'active'      => 1,
					] );
					$result->languages++;
				}
			}
		}

		// 2) Translation groups.
		if ( taxonomy_exists( 'post_translations' ) ) {
			$tx_terms = get_terms( [ 'taxonomy' => 'post_translations', 'hide_empty' => false ] );
			if ( ! is_wp_error( $tx_terms ) ) {
				foreach ( $tx_terms as $t ) {
					$map = maybe_unserialize( $t->description );
					if ( ! is_array( $map ) || empty( $map ) ) {
						continue;
					}
					// Source: pick the first language as canonical, but prefer
					// the post that exists in the registry's default language.
					$default_code = ( new LanguageRegistry() )->get_default()['code'] ?? null;
					$source_post  = $default_code && isset( $map[ $default_code ] ) ? (int) $map[ $default_code ] : (int) reset( $map );
					if ( ! get_post( $source_post ) ) {
						$result->skipped++;
						continue;
					}
					$group_id = TranslationLoader::ensure_group_for_post( $source_post, $default_code );
					if ( ! $group_id ) {
						continue;
					}
					foreach ( $map as $lang_code => $post_id ) {
						$post_id = (int) $post_id;
						if ( $post_id === $source_post ) {
							continue;
						}
						$post = get_post( $post_id );
						if ( ! $post ) {
							continue;
						}
						TranslationLoader::save_translation(
							$source_post,
							$lang_code,
							[
								'title'   => $post->post_title,
								'content' => $post->post_content,
								'excerpt' => $post->post_excerpt,
								'slug'    => $post->post_name,
								'status'  => $post->post_status,
							]
						);
						$result->posts++;
					}
				}
			}
		}

		return $result;
	}
}

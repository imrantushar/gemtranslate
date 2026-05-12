<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\Context;

/**
 * Looks up translations by post ID and current language. Each lookup is
 * cached at two levels:
 *   - object cache (cross-request, via TranslationCache)
 *   - request-level memo (avoid duplicate queries within one PHP process)
 *
 * The hot path on a default-language request short-circuits before doing
 * any work.
 */
class TranslationLoader {

	/**
	 * In-process memo keyed by "{post_id}:{lang}". Holds either the row
	 * array, or `false` meaning "no translation exists".
	 *
	 * @var array<string,array|false>
	 */
	private static $memo = [];

	/**
	 * Get the translation row for a given post in the current language.
	 *
	 * @param int $post_id
	 * @return array|null Row array or null when none.
	 */
	public static function get_for_post( $post_id ) {
		if ( Context::is_default() ) {
			return null;
		}
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return null;
		}
		$lang = Context::current();
		$memo_key = $post_id . ':' . $lang;

		if ( array_key_exists( $memo_key, self::$memo ) ) {
			return self::$memo[ $memo_key ] ?: null;
		}

		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			self::$memo[ $memo_key ] = false;
			return null;
		}

		$cache_key = $group_id . ':' . $lang;
		$row       = TranslationCache::get( TranslationCache::GROUP_POSTS, $cache_key );
		if ( false === $row ) {
			global $wpdb;
			$table = Helper::table( 'post_translations' );
			$row   = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM $table WHERE group_id = %d AND language_code = %s LIMIT 1",
					$group_id,
					$lang
				),
				ARRAY_A
			);
			$row = $row ?: null;
			TranslationCache::set( TranslationCache::GROUP_POSTS, $cache_key, $row );
		}

		self::$memo[ $memo_key ] = $row ?: false;
		return $row;
	}

	/**
	 * Return all translations for a post (one row per language). Used by the
	 * admin translation editor — not the hot path.
	 */
	public static function all_for_post( $post_id ) {
		$post_id  = (int) $post_id;
		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			return [];
		}
		global $wpdb;
		$table = Helper::table( 'post_translations' );
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM $table WHERE group_id = %d", $group_id ),
			ARRAY_A
		) ?: [];
	}

	/**
	 * Resolve the translation group for a post, creating a new group if missing.
	 *
	 * @return int Group ID, or 0 on failure.
	 */
	public static function ensure_group_for_post( $post_id, $source_language = null ) {
		$post_id = (int) $post_id;
		$group   = self::group_id_for_post( $post_id );
		if ( $group ) {
			return $group;
		}
		global $wpdb;
		$table   = Helper::table( 'translation_groups' );
		$source  = $source_language ?: Context::default_code();
		$wpdb->insert(
			$table,
			[
				'object_type'     => 'post',
				'source_language' => $source,
				'created_at'      => Helper::get_time(),
			]
		);
		$new_group = (int) $wpdb->insert_id;
		if ( $new_group ) {
			update_post_meta( $post_id, '_ztrans_group_id', $new_group );
			update_post_meta( $post_id, '_ztrans_source_lang', $source );
		}
		return $new_group;
	}

	public static function group_id_for_post( $post_id ) {
		$group = (int) get_post_meta( (int) $post_id, '_ztrans_group_id', true );
		return $group > 0 ? $group : 0;
	}

	public static function invalidate_post( $post_id ) {
		$post_id = (int) $post_id;
		$group   = self::group_id_for_post( $post_id );
		if ( $group ) {
			foreach ( Context::active_languages() as $code => $row ) {
				TranslationCache::delete( TranslationCache::GROUP_POSTS, $group . ':' . $code );
			}
		}
		foreach ( array_keys( self::$memo ) as $key ) {
			if ( 0 === strpos( $key, $post_id . ':' ) ) {
				unset( self::$memo[ $key ] );
			}
		}
	}

	/**
	 * Hash of the source content. Stored as `_ztrans_source_hash` post meta on
	 * the source post; translations record the hash they were derived from in
	 * the `source_hash` column. Translation is "stale" when those differ.
	 */
	public static function hash_source( $post ) {
		if ( is_numeric( $post ) ) {
			$post = get_post( $post );
		}
		if ( ! $post ) {
			return '';
		}
		return md5( $post->post_title . "\x1f" . $post->post_content . "\x1f" . $post->post_excerpt );
	}

	public static function get_source_hash( $post_id ) {
		return (string) get_post_meta( (int) $post_id, '_ztrans_source_hash', true );
	}

	/**
	 * Recompute and store the source hash. Returns true when it actually
	 * changed (i.e., source content was edited).
	 */
	public static function refresh_source_hash( $post_id ) {
		$current = self::get_source_hash( $post_id );
		$fresh   = self::hash_source( $post_id );
		if ( $fresh === $current ) {
			return false;
		}
		update_post_meta( (int) $post_id, '_ztrans_source_hash', $fresh );
		return true;
	}

	/**
	 * Map of language_code => 'translated' | 'stale' | 'missing' for a post.
	 */
	public static function status_map( $post_id ) {
		$post_id      = (int) $post_id;
		$source_hash  = self::get_source_hash( $post_id );
		$translations = self::all_for_post( $post_id );
		$map          = [];
		foreach ( $translations as $row ) {
			if ( $source_hash && $row['source_hash'] && $row['source_hash'] !== $source_hash ) {
				$map[ $row['language_code'] ] = 'stale';
			} else {
				$map[ $row['language_code'] ] = (string) $row['status'];
			}
		}
		return $map;
	}

	/**
	 * Save or update a translation for a post. Creates the group if needed.
	 *
	 * @return bool
	 */
	public static function save_translation( $post_id, $language_code, array $fields ) {
		$post_id  = (int) $post_id;
		$language = strtolower( $language_code );
		if ( $post_id <= 0 || ! $language ) {
			return false;
		}

		$group_id = self::ensure_group_for_post( $post_id );
		if ( ! $group_id ) {
			return false;
		}

		global $wpdb;
		$table = Helper::table( 'post_translations' );

		// Stamp the current source hash so we can detect staleness later.
		$source_hash = self::get_source_hash( $post_id );
		if ( '' === $source_hash ) {
			self::refresh_source_hash( $post_id );
			$source_hash = self::get_source_hash( $post_id );
		}

		$data = [
			'group_id'      => $group_id,
			'language_code' => $language,
			'post_id'       => $post_id,
			'title'         => (string) ( $fields['title'] ?? '' ),
			'content'       => (string) ( $fields['content'] ?? '' ),
			'excerpt'       => (string) ( $fields['excerpt'] ?? '' ),
			'slug'          => sanitize_title( $fields['slug'] ?? '' ),
			'status'        => (string) ( $fields['status'] ?? 'publish' ),
			'source_hash'   => (string) ( $fields['source_hash'] ?? $source_hash ),
			'updated_at'    => Helper::get_time(),
		];

		$exists = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE group_id = %d AND language_code = %s",
				$group_id,
				$language
			)
		);

		if ( $exists ) {
			$ok = $wpdb->update( $table, $data, [ 'group_id' => $group_id, 'language_code' => $language ] );
		} else {
			$ok = $wpdb->insert( $table, $data );
		}

		self::invalidate_post( $post_id );
		return $ok !== false;
	}

	public static function delete_translation( $post_id, $language_code ) {
		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			return false;
		}
		global $wpdb;
		$table = Helper::table( 'post_translations' );
		$ok    = $wpdb->delete( $table, [ 'group_id' => $group_id, 'language_code' => strtolower( $language_code ) ] );
		self::invalidate_post( $post_id );
		return $ok !== false;
	}
}

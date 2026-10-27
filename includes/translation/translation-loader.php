<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;

/**
 * Looks up translations by post ID, language, and visitor country. Lookups are
 * cached at two levels:
 *   - object cache (cross-request, via TranslationCache)
 *   - request-level memo (avoid duplicate queries within one PHP process)
 *
 * Default-language requests short-circuit before doing any work.
 *
 * Country waterfall (since v1.3):
 *   1. (group_id, lang, visitor_country)  — country-specific variant
 *   2. (group_id, lang, '')               — language default
 *   3. null                               — render the source post
 */
class TranslationLoader {

	const MODE_STRING_ONLY   = 'string_only';
	const MODE_CUSTOM_LAYOUT = 'custom_layout';

	/**
	 * In-process memo keyed by "{post_id}:{lang}:{country}". Holds either the
	 * resolved row array, or `false` meaning "no translation exists".
	 *
	 * @var array<string,array|false>
	 */
	private static $memo = [];

	/**
	 * Get the translation row for a given post in the current language, applying
	 * the country waterfall.
	 *
	 * @param int         $post_id
	 * @param string|null $country Override the visitor country (used by REST endpoints
	 *                             that scope to a specific variant). null = auto-detect.
	 * @return array|null Row array or null when none.
	 */
	public static function get_for_post( $post_id, $country = null ) {
		if ( Context::is_default() ) {
			return null;
		}
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return null;
		}
		$lang    = Context::current();
		$country = self::normalize_country( $country !== null ? $country : self::detect_country() );

		$memo_key = $post_id . ':' . $lang . ':' . $country;
		if ( array_key_exists( $memo_key, self::$memo ) ) {
			return self::$memo[ $memo_key ] ?: null;
		}

		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			self::$memo[ $memo_key ] = false;
			return null;
		}

		$row = self::fetch_row( $group_id, $lang, $country );
		if ( $row && ! self::is_servable( $row ) ) {
			$row = null;
		}
		if ( ! $row && '' !== $country ) {
			// Fall back to language-default variant.
			$row = self::fetch_row( $group_id, $lang, '' );
			if ( $row && ! self::is_servable( $row ) ) {
				$row = null;
			}
		}
		self::$memo[ $memo_key ] = $row ?: false;
		return $row;
	}

	/**
	 * Statuses that are NOT shown to visitors. A translation held for review (or
	 * rejected) must never render on the front end until it is approved — the
	 * page falls back to the source instead.
	 */
	const HIDDEN_STATUSES = [ 'needs_review', 'rejected' ];

	private static function is_servable( $row ) {
		return ! in_array( (string) ( $row['status'] ?? '' ), self::HIDDEN_STATUSES, true );
	}

	/**
	 * Flip a translation row's status (e.g. approve `needs_review` → `publish`)
	 * and invalidate caches so the change is visible immediately.
	 */
	public static function set_translation_status( $post_id, $language_code, $status, $country = null ) {
		$post_id  = (int) $post_id;
		$language = strtolower( $language_code );
		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id || '' === $language ) {
			return false;
		}
		$where = [ 'group_id' => $group_id, 'language_code' => $language ];
		if ( null !== $country ) {
			$where['country_code'] = self::normalize_country( $country );
		}
		global $wpdb;
		$ok = $wpdb->update(
			Helper::table( 'post_translations' ),
			[ 'status' => (string) $status, 'updated_at' => Helper::get_time() ],
			$where
		);
		self::invalidate_post( $post_id );
		return false !== $ok;
	}

	private static function fetch_row( $group_id, $lang, $country ) {
		$cache_key = $group_id . ':' . $lang . ':' . $country;
		$row       = TranslationCache::get( TranslationCache::GROUP_POSTS, $cache_key );
		if ( false === $row ) {
			global $wpdb;
			$table = Helper::table( 'post_translations' );
			$row   = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM $table WHERE group_id = %d AND language_code = %s AND country_code = %s LIMIT 1",
					$group_id,
					$lang,
					$country
				),
				ARRAY_A
			);
			$row = $row ?: null;
			TranslationCache::set( TranslationCache::GROUP_POSTS, $cache_key, $row );
		}
		return $row;
	}

	private static function detect_country() {
		if ( class_exists( CountryContext::class ) ) {
			return CountryContext::current();
		}
		return '';
	}

	private static function normalize_country( $country ) {
		$country = strtoupper( (string) $country );
		return preg_match( '/^[A-Z]{2}$/', $country ) ? $country : '';
	}

	/**
	 * Return all translation rows for a post (across languages AND countries).
	 * Used by the admin translation editor — not the hot path.
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
	 * Return translation rows for a post limited to a single language. Includes
	 * every country variant for that language.
	 */
	public static function variants_for_post( $post_id, $language_code ) {
		$post_id  = (int) $post_id;
		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			return [];
		}
		global $wpdb;
		$table = Helper::table( 'post_translations' );
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE group_id = %d AND language_code = %s ORDER BY country_code ASC",
				$group_id,
				strtolower( $language_code )
			),
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
		if ( $post_id <= 0 ) {
			return 0;
		}
		$group = self::group_id_for_post( $post_id );
		if ( $group ) {
			return $group;
		}
		// group_id == source post_id. Post IDs are globally unique within a site
		// and already auto-allocated by WP, so no dedicated groups table is
		// needed. Scope is per table (post_translations rows only).
		$source = $source_language ?: Context::default_code();
		update_post_meta( $post_id, '_gtrans_group_id', $post_id );
		update_post_meta( $post_id, '_gtrans_source_lang', $source );
		return $post_id;
	}

	public static function group_id_for_post( $post_id ) {
		$group = (int) get_post_meta( (int) $post_id, '_gtrans_group_id', true );
		return $group > 0 ? $group : 0;
	}

	/**
	 * Drop all cached rows + memos for a post, across every (lang, country) variant.
	 */
	public static function invalidate_post( $post_id ) {
		$post_id = (int) $post_id;
		$group   = self::group_id_for_post( $post_id );
		if ( $group ) {
			$language_codes = array_keys( Context::active_languages() );
			$countries      = self::known_countries_for_group( $group );
			$countries[]    = '';
			$countries      = array_unique( $countries );
			foreach ( $language_codes as $code ) {
				foreach ( $countries as $country ) {
					TranslationCache::delete(
						TranslationCache::GROUP_POSTS,
						$group . ':' . $code . ':' . $country
					);
				}
			}
		}
		foreach ( array_keys( self::$memo ) as $key ) {
			if ( 0 === strpos( $key, $post_id . ':' ) ) {
				unset( self::$memo[ $key ] );
			}
		}
	}

	private static function known_countries_for_group( $group_id ) {
		global $wpdb;
		$table = Helper::table( 'post_translations' );
		$rows  = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT country_code FROM $table WHERE group_id = %d",
				$group_id
			)
		) ?: [];
		return array_map( 'strval', $rows );
	}

	/**
	 * Hash of the source content. Stored as `_gtrans_source_hash` post meta on
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
		return (string) get_post_meta( (int) $post_id, '_gtrans_source_hash', true );
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
		update_post_meta( (int) $post_id, '_gtrans_source_hash', $fresh );
		return true;
	}

	/**
	 * Map of language_code => 'translated' | 'stale' | 'missing' for a post.
	 *
	 * For `string_only` rows we never report 'stale' — the render path always
	 * re-applies translations to the current source layout, so layout edits
	 * cannot leave them out of date. Whether all strings have been translated
	 * is reported separately via the dedicated fields endpoint.
	 *
	 * Aggregates across country variants by keeping the "most translated" state
	 * per language (translated > pending > stale > missing).
	 */
	public static function status_map( $post_id ) {
		$post_id      = (int) $post_id;
		$source_hash  = self::get_source_hash( $post_id );
		$translations = self::all_for_post( $post_id );
		$priority     = [ 'translated' => 6, 'publish' => 6, 'needs_review' => 5, 'pending' => 4, 'draft' => 3, 'stale' => 2, 'rejected' => 1, 'missing' => 0 ];
		$map          = [];
		foreach ( $translations as $row ) {
			$lang   = (string) $row['language_code'];
			$mode   = $row['translation_mode'] ?? self::MODE_CUSTOM_LAYOUT;
			$status = (string) $row['status'];
			if ( self::MODE_CUSTOM_LAYOUT === $mode
				&& $source_hash
				&& ! empty( $row['source_hash'] )
				&& $row['source_hash'] !== $source_hash
			) {
				$status = 'stale';
			}
			$prev = $map[ $lang ] ?? null;
			if ( null === $prev || ( $priority[ $status ] ?? 0 ) > ( $priority[ $prev ] ?? 0 ) ) {
				$map[ $lang ] = $status;
			}
		}
		return $map;
	}

	/**
	 * Save or update a translation row for a post. Creates the group if needed.
	 *
	 * Accepted $fields keys (all optional except 'title' / 'content' / 'excerpt'
	 * which default to ''):
	 *   - title, content, excerpt, slug, status
	 *   - country_code      ISO-3166 alpha-2 (or '' for language default)
	 *   - translation_mode  'string_only' | 'custom_layout' (defaults to existing
	 *                       row's mode if updating, else 'custom_layout' for
	 *                       backwards-compat with the legacy save path).
	 *   - source_hash       defaults to the source post's current hash.
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

		$country = self::normalize_country( $fields['country_code'] ?? '' );

		// Stamp the current source hash so we can detect staleness later.
		$source_hash = self::get_source_hash( $post_id );
		if ( '' === $source_hash ) {
			self::refresh_source_hash( $post_id );
			$source_hash = self::get_source_hash( $post_id );
		}

		$raw_slug = (string) ( $fields['slug'] ?? '' );
		$slug     = sanitize_title( $raw_slug );
		// sanitize_title() strips all non-ASCII via [^%a-z0-9 _-], so Devanagari,
		// Arabic, CJK, etc. produce an empty string. Fall back to the source
		// post's slug so the translated URL stays valid.
		if ( '' === $slug && '' !== $raw_slug ) {
			$slug = (string) get_post_field( 'post_name', $post_id );
		}

		$existing = self::fetch_row( $group_id, $language, $country );
		$mode     = self::MODE_CUSTOM_LAYOUT;
		if ( isset( $fields['translation_mode'] ) ) {
			$mode = self::normalize_mode( $fields['translation_mode'] );
		} elseif ( $existing ) {
			$mode = self::normalize_mode( $existing['translation_mode'] ?? self::MODE_CUSTOM_LAYOUT );
		}

		$shadow_post_id = isset( $fields['shadow_post_id'] )
			? (int) $fields['shadow_post_id']
			: (int) ( $existing['shadow_post_id'] ?? 0 );

		// Partial updates: when a caller passes only a subset of fields
		// (e.g. just {title, slug}), keep the existing row's other columns
		// instead of overwriting them with empty strings. On a fresh insert
		// the existing-row map is empty and defaults apply.
		$base = $existing ?: [];
		$data = [
			'group_id'         => $group_id,
			'language_code'    => $language,
			'country_code'     => $country,
			'post_id'          => $post_id,
			'shadow_post_id'   => $shadow_post_id,
			'title'            => array_key_exists( 'title', $fields )   ? (string) $fields['title']   : (string) ( $base['title']   ?? '' ),
			'content'          => array_key_exists( 'content', $fields ) ? (string) $fields['content'] : (string) ( $base['content'] ?? '' ),
			'excerpt'          => array_key_exists( 'excerpt', $fields ) ? (string) $fields['excerpt'] : (string) ( $base['excerpt'] ?? '' ),
			'slug'             => array_key_exists( 'slug', $fields )    ? $slug                       : (string) ( $base['slug']    ?? '' ),
			'status'           => (string) ( $fields['status'] ?? $base['status'] ?? 'publish' ),
			'translation_mode' => $mode,
			'source_hash'      => (string) ( $fields['source_hash'] ?? $base['source_hash'] ?? $source_hash ),
			'updated_at'       => Helper::get_time(),
		];

		if ( $existing ) {
			// Revision history is a Pro feature — snapshot only when present.
			if ( class_exists( TranslationHistory::class ) ) {
				TranslationHistory::snapshot_existing( $existing );
			}
			$ok = $wpdb->update(
				$table,
				$data,
				[ 'group_id' => $group_id, 'language_code' => $language, 'country_code' => $country ]
			);
		} else {
			$ok = $wpdb->insert( $table, $data );
		}

		self::invalidate_post( $post_id );
		return $ok !== false;
	}

	private static function normalize_mode( $mode ) {
		$mode = (string) $mode;
		return self::MODE_STRING_ONLY === $mode ? self::MODE_STRING_ONLY : self::MODE_CUSTOM_LAYOUT;
	}

	/**
	 * Save a single translated string for a post field (string_only mode).
	 *
	 * The string is keyed by *source text* within the post's translation group,
	 * NOT by the block path. That means moving a block around the page doesn't
	 * orphan its translation — the next render re-binds by source value at the
	 * block's new position. Duplicate source text (e.g., a label that appears
	 * twice) shares one translation by design.
	 *
	 * The `$field_path` argument is kept in the signature so the REST layer can
	 * stay path-aware (for AI-fill, undo, etc.), but it's not part of the
	 * storage key.
	 *
	 * @param int    $post_id
	 * @param string $language_code
	 * @param string $field_path  BlockParser path, or 'title' / 'excerpt' / 'body'. (Informational.)
	 * @param string $source      Original source value (this IS the storage key).
	 * @param string $translation Translated value.
	 * @param string $country     Country variant ('' for language default).
	 * @return bool
	 */
	public static function save_string_translation( $post_id, $language_code, $field_path, $source, $translation, $country = '' ) {
		$post_id  = (int) $post_id;
		$language = strtolower( $language_code );
		$source   = (string) $source;
		if ( $post_id <= 0 || '' === $language || '' === $source ) {
			return false;
		}
		$group_id = self::ensure_group_for_post( $post_id );
		if ( ! $group_id ) {
			return false;
		}

		$context   = self::string_context_for_group( $group_id );
		$string_id = StringTranslator::register_string( $source, 'ztrans:post', $context );
		if ( ! $string_id ) {
			return false;
		}
		$ok = StringTranslator::save_translation(
			$string_id,
			$language,
			(string) $translation,
			'' === (string) $translation ? 'draft' : 'translated'
		);

		// Ensure a parent row exists in string_only mode, so the render path
		// knows to rebuild from source + strings.
		self::ensure_string_only_row( $post_id, $group_id, $language, self::normalize_country( $country ) );
		self::invalidate_post( $post_id );
		unset( $field_path );
		return $ok;
	}

	/**
	 * Bulk lookup of translated strings for a post in a given language.
	 *
	 * Returns a map of **source text** => translated value. The render path
	 * walks the current source blocks and looks each value up here.
	 */
	public static function load_string_translations_for_post( $post_id, $language_code ) {
		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			return [];
		}
		global $wpdb;
		$st  = Helper::table( 'strings' );
		$stt = Helper::table( 'string_translations' );
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.source, t.value
				 FROM $st AS s
				 INNER JOIN $stt AS t ON t.string_id = s.string_id
				 WHERE s.domain = %s
				   AND s.context = %s
				   AND t.language_code = %s
				   AND t.value <> ''",
				'ztrans:post',
				self::string_context_for_group( $group_id ),
				strtolower( $language_code )
			),
			ARRAY_A
		) ?: [];

		$out = [];
		foreach ( $rows as $row ) {
			$src = (string) $row['source'];
			if ( '' !== $src ) {
				$out[ $src ] = (string) $row['value'];
			}
		}
		return $out;
	}

	private static function ensure_string_only_row( $post_id, $group_id, $language, $country ) {
		$existing = self::fetch_row( $group_id, $language, $country );
		if ( $existing ) {
			if ( self::MODE_STRING_ONLY !== ( $existing['translation_mode'] ?? '' ) ) {
				global $wpdb;
				$wpdb->update(
					Helper::table( 'post_translations' ),
					[ 'translation_mode' => self::MODE_STRING_ONLY, 'updated_at' => Helper::get_time() ],
					[ 'group_id' => $group_id, 'language_code' => $language, 'country_code' => $country ]
				);
			}
			return;
		}
		$source_hash = self::get_source_hash( $post_id );
		if ( '' === $source_hash ) {
			self::refresh_source_hash( $post_id );
			$source_hash = self::get_source_hash( $post_id );
		}
		$post = get_post( $post_id );
		global $wpdb;
		$wpdb->insert(
			Helper::table( 'post_translations' ),
			[
				'group_id'         => $group_id,
				'language_code'    => $language,
				'country_code'     => $country,
				'post_id'          => $post_id,
				'title'            => '',
				'content'          => '',
				'excerpt'          => '',
				'slug'             => $post ? (string) $post->post_name : '',
				'status'           => 'publish',
				'translation_mode' => self::MODE_STRING_ONLY,
				'source_hash'      => $source_hash,
				'updated_at'       => Helper::get_time(),
			]
		);
	}

	public static function string_context_for_group( $group_id ) {
		return 'post:' . (int) $group_id;
	}

	/**
	 * Look up the post_translations row that owns a given shadow post.
	 * Used by ShadowPostSync to mirror shadow edits back into our row.
	 */
	public static function find_by_shadow_post_id( $shadow_post_id ) {
		$shadow_post_id = (int) $shadow_post_id;
		if ( $shadow_post_id <= 0 ) {
			return null;
		}
		global $wpdb;
		$table = Helper::table( 'post_translations' );
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE shadow_post_id = %d LIMIT 1", $shadow_post_id ),
			ARRAY_A
		);
		return $row ?: null;
	}

	/**
	 * Update a row in-place without snapshotting history or recomputing
	 * source hash. Used by the shadow→canonical mirror, which already has
	 * fully-formed values.
	 */
	public static function update_row( $group_id, $language_code, $country_code, array $changes ) {
		if ( empty( $changes ) ) {
			return false;
		}
		global $wpdb;
		$changes['updated_at'] = Helper::get_time();
		$ok = $wpdb->update(
			Helper::table( 'post_translations' ),
			$changes,
			[
				'group_id'      => (int) $group_id,
				'language_code' => strtolower( $language_code ),
				'country_code'  => self::normalize_country( $country_code ),
			]
		);
		// Find the post_id so we can invalidate caches.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT post_id FROM " . Helper::table( 'post_translations' ) . "
				 WHERE group_id = %d AND language_code = %s AND country_code = %s LIMIT 1",
				$group_id,
				strtolower( $language_code ),
				self::normalize_country( $country_code )
			),
			ARRAY_A
		);
		if ( $row && ! empty( $row['post_id'] ) ) {
			self::invalidate_post( (int) $row['post_id'] );
		}
		return $ok !== false;
	}

	public static function delete_translation( $post_id, $language_code, $country_code = null ) {
		$group_id = self::group_id_for_post( $post_id );
		if ( ! $group_id ) {
			return false;
		}
		global $wpdb;
		$table  = Helper::table( 'post_translations' );
		$where  = [ 'group_id' => $group_id, 'language_code' => strtolower( $language_code ) ];
		if ( null !== $country_code ) {
			$where['country_code'] = self::normalize_country( $country_code );
		}
		$ok = $wpdb->delete( $table, $where );
		self::invalidate_post( $post_id );
		return $ok !== false;
	}
}

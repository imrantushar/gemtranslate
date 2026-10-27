<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Translation\EditorContext;

/**
 * Glue between custom-layout translations and the real WP post that backs them.
 *
 * Each `translation_mode = 'custom_layout'` row in `post_translations` can own
 * a "shadow" post — a real WordPress post the admin edits in whatever editor
 * they want (Gutenberg, Elementor, Beaver, Divi, Bricks). Page builders work
 * for free because to them it's just a normal post.
 *
 * Responsibilities:
 *   1. `save_post` mirror — when the shadow is edited, copy title/content/excerpt
 *      back into the parent `post_translations` row so the React editor's
 *      preview and history stay in sync.
 *   2. `the_posts` swap — at render time, when the visitor lands on the source
 *      URL with a non-default language and a shadow exists, replace the source
 *      post in WP's main loop with the shadow. Every downstream hook (page
 *      builder frontends, ACF, etc.) operates on the shadow.
 *   3. `pre_get_posts` hide — exclude shadow posts from admin posts list,
 *      search, sitemaps, archives. The shadow has no URL of its own; the source
 *      URL with the language prefix is the only way to reach it.
 *   4. Delete cascade — when the source is deleted, trash all its shadows.
 *      When a shadow is deleted, clear `shadow_post_id` on its row.
 */
class ShadowPostSync {

	const META_SOURCE   = '_gtrans_translation_of';
	const META_LANG     = '_gtrans_lang';
	const META_COUNTRY  = '_gtrans_country';

	public static function init() {
		add_action( 'save_post', [ __CLASS__, 'on_shadow_saved' ], 30, 3 );
		add_action( 'before_delete_post', [ __CLASS__, 'on_post_deleted' ] );
		add_action( 'wp_trash_post', [ __CLASS__, 'on_post_deleted' ] );

		// Render-time swap. `the_posts` fires inside WP_Query, after the
		// query runs. Replacing the post object here lets page builders see
		// the shadow during their frontend rendering pass.
		add_filter( 'the_posts', [ __CLASS__, 'swap_in_shadow_posts' ], 5, 2 );

		// Hide shadows from admin posts list, frontend search, sitemaps, etc.
		add_action( 'pre_get_posts', [ __CLASS__, 'hide_shadows' ] );
	}

	/**
	 * Create (or return existing) shadow post for a translation row.
	 *
	 * @return int Shadow post ID, or 0 on failure.
	 */
	public static function ensure_for(
		$source_post_id,
		$language,
		$country,
		array $seed = []
	) {
		$source = get_post( (int) $source_post_id );
		if ( ! $source ) {
			return 0;
		}
		$row = self::find_row( $source_post_id, $language, $country );
		if ( $row && ! empty( $row['shadow_post_id'] ) ) {
			// Confirm the shadow post actually exists; if it was trashed/deleted
			// outside our flow, create a new one.
			$existing = get_post( (int) $row['shadow_post_id'] );
			if ( $existing && 'trash' !== $existing->post_status ) {
				return (int) $existing->ID;
			}
		}

		$shadow_id = wp_insert_post(
			[
				'post_type'    => $source->post_type,
				'post_status'  => 'publish',
				'post_title'   => (string) ( $seed['title']   ?? $source->post_title ),
				'post_content' => (string) ( $seed['content'] ?? $source->post_content ),
				'post_excerpt' => (string) ( $seed['excerpt'] ?? $source->post_excerpt ),
				'post_author'  => $source->post_author ?: get_current_user_id(),
				// Unique slug — we never expose it as a URL, but WP needs one.
				'post_name'    => self::derive_shadow_slug( $source, $language, $country ),
				'meta_input'   => [
					self::META_SOURCE  => (int) $source->ID,
					self::META_LANG    => strtolower( $language ),
					self::META_COUNTRY => strtoupper( $country ),
				],
			],
			true
		);
		if ( is_wp_error( $shadow_id ) || ! $shadow_id ) {
			return 0;
		}

		// Persist the link in our row.
		TranslationLoader::save_translation( $source_post_id, $language, [
			'title'            => (string) ( $seed['title']   ?? '' ),
			'content'          => (string) ( $seed['content'] ?? '' ),
			'excerpt'          => (string) ( $seed['excerpt'] ?? '' ),
			'slug'             => (string) ( $seed['slug']    ?? $source->post_name ),
			'status'           => 'publish',
			'country_code'     => $country,
			'translation_mode' => TranslationLoader::MODE_CUSTOM_LAYOUT,
			'shadow_post_id'   => (int) $shadow_id,
		] );

		return (int) $shadow_id;
	}

	/**
	 * Build the wp-admin edit URL for a shadow post. Honors whatever editor
	 * is registered for the post type (Gutenberg by default; page builders
	 * inject their own "Edit with X" actions on top of this URL).
	 */
	public static function edit_url( $shadow_post_id ) {
		$shadow_post_id = (int) $shadow_post_id;
		if ( $shadow_post_id <= 0 ) {
			return '';
		}
		return (string) get_edit_post_link( $shadow_post_id, 'raw' );
	}

	/**
	 * Trash the shadow post for a translation row, if any, and clear the link.
	 */
	public static function trash_for( $source_post_id, $language, $country ) {
		$row = self::find_row( $source_post_id, $language, $country );
		if ( ! $row || empty( $row['shadow_post_id'] ) ) {
			return false;
		}
		$shadow_id = (int) $row['shadow_post_id'];
		wp_trash_post( $shadow_id );
		TranslationLoader::update_row(
			(int) $row['group_id'],
			(string) $row['language_code'],
			(string) $row['country_code'],
			[ 'shadow_post_id' => 0 ]
		);
		return true;
	}

	// -----------------------------------------------------------------------
	// Hooks
	// -----------------------------------------------------------------------

	public static function on_shadow_saved( $post_id, $post, $update ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		$source_id = (int) get_post_meta( $post_id, self::META_SOURCE, true );
		if ( ! $source_id ) {
			return; // Not a shadow.
		}
		$row = TranslationLoader::find_by_shadow_post_id( $post_id );
		if ( ! $row ) {
			return;
		}
		// Mirror current shadow fields into our row.
		TranslationLoader::update_row(
			(int) $row['group_id'],
			(string) $row['language_code'],
			(string) $row['country_code'],
			[
				'title'   => (string) $post->post_title,
				'content' => (string) $post->post_content,
				'excerpt' => (string) $post->post_excerpt,
				'status'  => (string) $post->post_status,
			]
		);
	}

	public static function on_post_deleted( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return;
		}
		// Case 1: a shadow is being deleted → clear shadow_post_id on its row.
		if ( get_post_meta( $post_id, self::META_SOURCE, true ) ) {
			$row = TranslationLoader::find_by_shadow_post_id( $post_id );
			if ( $row ) {
				TranslationLoader::update_row(
					(int) $row['group_id'],
					(string) $row['language_code'],
					(string) $row['country_code'],
					[ 'shadow_post_id' => 0 ]
				);
			}
			return;
		}
		// Case 2: a source is being deleted → trash all of its shadows.
		global $wpdb;
		$table = \GemTranslate\Helper::table( 'post_translations' );
		$shadows = $wpdb->get_col(
			$wpdb->prepare( "SELECT shadow_post_id FROM $table WHERE post_id = %d AND shadow_post_id > 0", (int) $post_id )
		);
		foreach ( (array) $shadows as $shadow_id ) {
			wp_trash_post( (int) $shadow_id );
		}
	}

	/**
	 * Replace the source post in WP's main loop with its shadow when the
	 * current language has a custom-layout translation. Runs only on the
	 * frontend, only for the main query, so admin views still operate on
	 * the source.
	 */
	public static function swap_in_shadow_posts( $posts, $query = null ) {
		// Editor surfaces (Gutenberg, classic, edit-tags, edit-list, and the
		// REST `context=edit` fetch Gutenberg uses) MUST see the source post.
		// Frontend rendering — including admin-bar "Preview" sessions where the
		// visitor cookie is set — still gets the shadow swap.
		if ( EditorContext::is_render_target() ) {
			return $posts;
		}
		if ( Context::is_default() ) {
			return $posts;
		}
		if ( empty( $posts ) || ! is_array( $posts ) ) {
			return $posts;
		}
		foreach ( $posts as $i => $post ) {
			if ( ! is_object( $post ) || ! isset( $post->ID ) ) {
				continue;
			}
			// Skip posts that ARE shadows — we never serve those directly.
			if ( get_post_meta( $post->ID, self::META_SOURCE, true ) ) {
				continue;
			}
			$row = TranslationLoader::get_for_post( (int) $post->ID );
			if ( ! $row ) {
				continue;
			}
			if ( TranslationLoader::MODE_CUSTOM_LAYOUT !== ( $row['translation_mode'] ?? '' ) ) {
				continue;
			}
			if ( empty( $row['shadow_post_id'] ) ) {
				continue;
			}
			$shadow = get_post( (int) $row['shadow_post_id'] );
			if ( ! $shadow || 'publish' !== $shadow->post_status ) {
				continue;
			}
			// Keep the SOURCE slug so URLs/permalinks generated downstream
			// still match the language-prefixed URL the visitor used.
			$shadow->post_name = $post->post_name;
			$shadow->guid      = $post->guid;
			$posts[ $i ]       = $shadow;
		}
		return $posts;
	}

	/**
	 * Exclude shadow posts from queries that aren't explicitly fetching them
	 * by ID. Keeps them out of admin lists, frontend search, archives, and
	 * sitemap generators.
	 */
	public static function hide_shadows( $query ) {
		// Direct fetches by ID/slug bypass the exclusion so the shadow can
		// still be loaded by `get_post()` and `the_posts` swap.
		if ( ! ( $query instanceof \WP_Query ) ) {
			return;
		}
		if ( $query->get( 'p' ) || $query->get( 'post__in' ) || $query->get( 'page_id' ) ) {
			return;
		}
		$meta_query   = (array) $query->get( 'meta_query' );
		$meta_query[] = [
			'key'     => self::META_SOURCE,
			'compare' => 'NOT EXISTS',
		];
		$query->set( 'meta_query', $meta_query );
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	private static function find_row( $source_post_id, $language, $country ) {
		foreach ( TranslationLoader::variants_for_post( $source_post_id, $language ) as $row ) {
			if ( (string) $row['country_code'] === strtoupper( (string) $country ) ) {
				return $row;
			}
		}
		return null;
	}

	private static function derive_shadow_slug( $source, $language, $country ) {
		$base = $source->post_name ?: sanitize_title( $source->post_title );
		$tag  = strtolower( $language );
		if ( '' !== $country ) {
			$tag .= '-' . strtolower( $country );
		}
		return sanitize_title( $base . '--ztrans-' . $tag );
	}
}

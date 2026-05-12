<?php
namespace Zentranslate\Cache;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Translation\TranslationLoader;

/**
 * Fires generic invalidation hooks that compat bridges subscribe to.
 */
class Invalidator {

	public static function init() {
		add_action( 'save_post', [ __CLASS__, 'on_post_saved' ], 20 );
		add_action( 'before_delete_post', [ __CLASS__, 'on_post_deleted' ] );
	}

	public static function on_post_saved( $post_id ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		// Recompute the source hash. If it changed, existing translations
		// become "stale" — surfaced by TranslationLoader::status_map().
		TranslationLoader::refresh_source_hash( $post_id );
		TranslationLoader::invalidate_post( $post_id );
		do_action( 'ztrans_translation_saved', $post_id );
	}

	public static function on_post_deleted( $post_id ) {
		TranslationLoader::invalidate_post( $post_id );
		do_action( 'ztrans_translation_saved', $post_id );
	}
}

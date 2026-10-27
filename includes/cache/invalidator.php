<?php
namespace GemTranslate\Cache;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Translation\PostFieldTranslator;
use GemTranslate\Translation\StringTranslator;
use GemTranslate\Translation\TranslationLoader;

/**
 * Fires generic invalidation hooks that compat bridges subscribe to.
 *
 * String-only translations don't go "stale" on a layout edit — the render path
 * always re-applies the stored string map to the current source blocks. We
 * just flush memoized maps so the next request re-queries the strings table.
 *
 * Custom-layout translations keep the legacy stale-on-source-change behavior:
 * the source hash changed, the stored content blob is now out of date, and
 * the admin sees a "stale" pill until they re-translate.
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
		// Recompute the source hash; custom_layout translations use the diff
		// as a "needs review" signal (surfaced via TranslationLoader::status_map()).
		TranslationLoader::refresh_source_hash( $post_id );
		TranslationLoader::invalidate_post( $post_id );
		PostFieldTranslator::flush_memo();
		StringTranslator::flush_runtime_cache();
		do_action( 'gtrans_translation_saved', $post_id );
	}

	public static function on_post_deleted( $post_id ) {
		TranslationLoader::invalidate_post( $post_id );
		PostFieldTranslator::flush_memo();
		do_action( 'gtrans_translation_saved', $post_id );
	}
}

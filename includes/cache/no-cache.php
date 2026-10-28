<?php
namespace GemTranslate\Cache;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Marks the current response as not shareable between visitors.
 *
 * A page whose content depends on the visitor's country is served from the
 * same URL for everyone, so a page cache (plugin, CDN, browser) must not store
 * one visitor's variant and hand it to the next. Call this wherever the
 * response was chosen from per-visitor state.
 */
class NoCache {

	/**
	 * @return void
	 */
	public static function send() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		// Honoured by WP Rocket, W3 Total Cache, LiteSpeed Cache, WP Super Cache.
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		if ( ! headers_sent() ) {
			nocache_headers();
			header( 'Cache-Control: private, no-store, max-age=0', true );
		}
	}
}

<?php
namespace Zentranslate\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WP Rocket bridge.
 *
 * Subdirectory URLs naturally yield distinct cache files. We additionally
 * register a dynamic cookie so logged-in language-override states never
 * pollute the anonymous cache.
 */
class WpRocket {

	public static function init() {
		if ( ! function_exists( 'rocket_clean_domain' ) ) {
			return;
		}
		add_filter( 'rocket_cache_dynamic_cookies', [ __CLASS__, 'register_cookie' ] );

		// Clear cache when a translation is saved or a language toggles.
		add_action( 'ztrans_translation_saved', [ __CLASS__, 'flush' ] );
		add_action( 'ztrans_language_changed', [ __CLASS__, 'flush' ] );
	}

	public static function register_cookie( $cookies ) {
		$cookies[] = 'ztrans_user_lang';
		return $cookies;
	}

	public static function flush() {
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}
	}
}

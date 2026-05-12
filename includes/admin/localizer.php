<?php
namespace Zentranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;

/**
 * Bridges Zentranslate's per-user language preference to WordPress's locale
 * system inside the admin. With the locale filter in place:
 *
 * - WP core admin strings load from their `.mo` file for the chosen locale
 *   (if installed), so the entire admin UI changes language naturally.
 * - Plugin/theme strings using gettext flow through StringTranslator as
 *   usual; the locale filter aligns the underlying domain loading.
 * - `wp_set_script_translations` picks up the user's locale for the
 *   Zentranslate React admin, loading the matching `-{locale}-{handle}.json`.
 */
class Localizer {

	public static function init() {
		add_filter( 'locale', [ __CLASS__, 'filter_admin_locale' ] );
		add_filter( 'plugin_locale', [ __CLASS__, 'filter_plugin_locale' ], 10, 2 );
	}

	/**
	 * Switch the admin locale to the current user's preferred Zentranslate
	 * language. Front-end requests are untouched.
	 */
	public static function filter_admin_locale( $locale ) {
		if ( ! is_admin() ) {
			return $locale;
		}
		$mapped = self::current_user_locale();
		return $mapped ?: $locale;
	}

	/**
	 * Override the plugin locale specifically — covers contexts where
	 * `plugin_locale` is consulted (e.g., load_textdomain).
	 */
	public static function filter_plugin_locale( $locale, $domain ) {
		// Only intervene in admin to avoid surprising the frontend.
		if ( ! is_admin() ) {
			return $locale;
		}
		$mapped = self::current_user_locale();
		return $mapped ?: $locale;
	}

	private static function current_user_locale() {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return '';
		}
		$pref = (string) get_user_meta( $user_id, ProfileField::META_KEY, true );
		if ( '' === $pref ) {
			return '';
		}
		$languages = Context::active_languages();
		return $languages[ $pref ]['locale'] ?? '';
	}
}

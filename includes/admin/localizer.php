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
		// `determine_locale` (WP 5.0+) is consulted by wp_set_script_translations()
		// and other places that the older `locale` filter misses.
		add_filter( 'determine_locale', [ __CLASS__, 'filter_admin_locale' ] );
		add_filter( 'plugin_locale', [ __CLASS__, 'filter_plugin_locale' ], 10, 2 );

		// `load_default_textdomain()` runs inside wp-settings.php *before*
		// `plugins_loaded`, so WP core admin strings are loaded in the site
		// default language regardless of our locale filter. Reload at init
		// priority 20 (after RequestParser sets Context at priority 10) so the
		// WP admin UI — menus, admin bar, notices — appears in the user's language.
		add_action( 'init', [ __CLASS__, 'reload_core_textdomain' ], 20 );
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
	public static function filter_plugin_locale( $locale, $_domain ) {
		// Only intervene in admin to avoid surprising the frontend.
		if ( ! is_admin() ) {
			return $locale;
		}
		$mapped = self::current_user_locale();
		return $mapped ?: $locale;
	}

	/**
	 * Force-reload the WordPress core text domain with the user's preferred
	 * locale. Called at init priority 20 — Context and the current user are
	 * both fully set by then.
	 *
	 * Without this, `load_default_textdomain()` (which ran before plugins_loaded)
	 * would have already cached all WP core strings in the site's default locale.
	 */
	public static function reload_core_textdomain() {
		if ( ! is_admin() ) {
			return;
		}
		$locale = self::current_user_locale();
		if ( ! $locale ) {
			return;
		}
		// Compare against the raw site locale stored in the DB option, not
		// get_locale() — that applies our own filter and always returns the
		// user's preferred locale, making the comparison a no-op every time.
		// An empty WPLANG option means the WP installation is English (en_US).
		$site_locale = (string) get_option( 'WPLANG', '' );
		if ( '' === $site_locale ) {
			$site_locale = 'en_US';
		}
		if ( $locale === $site_locale ) {
			return;
		}
		unload_textdomain( 'default' );
		load_default_textdomain( $locale );
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

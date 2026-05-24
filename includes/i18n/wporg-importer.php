<?php
namespace Zentranslate\I18n;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Translation\StringTranslator;

/**
 * Bridges translate.wordpress.org community translations into our own
 * `wp_ztrans_string_translations` table so the admin sees them as
 * pre-existing translations rather than empty rows.
 *
 * On a per-package scan we:
 *   1. For every active non-default language, look for the WP.org-installed
 *      .mo file at `wp-content/languages/plugins/{slug}-{locale}.mo`.
 *   2. If present, parse it with WP core's `\MO` class.
 *   3. For each entry, look up our string row by source text + domain and,
 *      if we have NO existing translation yet, insert the community value
 *      with status `wp_org`. We NEVER clobber a user edit.
 *
 * Hosted-on-WP.org sniff is exposed as `is_hosted()` for the package-list
 * endpoint, with a 24h transient cache so we don't hit api.wordpress.org on
 * every request.
 */
class WporgImporter {

	const TRANSIENT_PREFIX = 'ztrans_wporg_hosted_';
	const TRANSIENT_TTL    = DAY_IN_SECONDS;

	/**
	 * Pull every available WP.org translation for one package into our table.
	 *
	 * @param string   $domain    Plugin/theme text domain (e.g. 'woocommerce').
	 * @param string[] $locales   List of WP locales to try (e.g. ['es_ES', 'fr_FR']).
	 * @param string[] $codes     Matching active language codes for each locale,
	 *                            same order. ('es', 'fr')
	 * @return array{imported:int,locales:array<string,int>} per-locale counts.
	 */
	public static function import_for_package( $domain, array $locales, array $codes ) {
		require_once ABSPATH . 'wp-includes/pomo/mo.php';

		$total       = 0;
		$per_locale  = [];

		foreach ( $locales as $i => $locale ) {
			$code   = strtolower( (string) ( $codes[ $i ] ?? '' ) );
			$mo_path = trailingslashit( WP_LANG_DIR ) . 'plugins/' . $domain . '-' . $locale . '.mo';
			if ( '' === $code || ! file_exists( $mo_path ) ) {
				$per_locale[ $locale ] = 0;
				continue;
			}

			$mo = new \MO();
			if ( ! $mo->import_from_file( $mo_path ) ) {
				$per_locale[ $locale ] = 0;
				continue;
			}

			$imported = 0;
			foreach ( $mo->entries as $entry ) {
				$source      = (string) $entry->singular;
				$translation = isset( $entry->translations[0] ) ? (string) $entry->translations[0] : '';
				$context     = (string) ( $entry->context ?? '' );
				if ( '' === $source || '' === $translation ) {
					continue;
				}
				$string_id = StringTranslator::register_string( $source, $domain, $context );
				if ( ! $string_id ) {
					continue;
				}
				if ( StringTranslator::has_translation( $string_id, $code ) ) {
					continue; // Never clobber an existing user/draft/wp_org row.
				}
				if ( StringTranslator::save_translation( $string_id, $code, $translation, 'wp_org' ) ) {
					$imported++;
				}
			}

			$per_locale[ $locale ] = $imported;
			$total                += $imported;
		}

		return [
			'imported' => $total,
			'locales'  => $per_locale,
		];
	}

	/**
	 * Returns true when a plugin is hosted on wordpress.org/plugins/{slug}/.
	 * Cached for 24h. Themes use a separate sniff via the themes API.
	 *
	 * @param string $slug Plugin slug (e.g. 'woocommerce').
	 * @return bool
	 */
	public static function is_hosted_plugin( $slug ) {
		$slug = sanitize_key( $slug );
		if ( '' === $slug ) {
			return false;
		}
		$cached = get_transient( self::TRANSIENT_PREFIX . 'plugin_' . $slug );
		if ( false !== $cached ) {
			return 'yes' === $cached;
		}
		$response = wp_remote_get(
			"https://api.wordpress.org/plugins/info/1.0/{$slug}.json",
			[ 'timeout' => 4 ]
		);
		$hosted = ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response );
		set_transient( self::TRANSIENT_PREFIX . 'plugin_' . $slug, $hosted ? 'yes' : 'no', self::TRANSIENT_TTL );
		return $hosted;
	}

	public static function is_hosted_theme( $slug ) {
		$slug = sanitize_key( $slug );
		if ( '' === $slug ) {
			return false;
		}
		$cached = get_transient( self::TRANSIENT_PREFIX . 'theme_' . $slug );
		if ( false !== $cached ) {
			return 'yes' === $cached;
		}
		$response = wp_remote_get(
			"https://api.wordpress.org/themes/info/1.1/?action=theme_information&request[slug]={$slug}",
			[ 'timeout' => 4 ]
		);
		$ok = ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response );
		// The themes endpoint returns 200 with a serialized PHP `false` body when
		// the slug isn't hosted, so check the payload too.
		if ( $ok ) {
			$body  = (string) wp_remote_retrieve_body( $response );
			$first = ltrim( $body );
			$ok    = '' !== $body && 'false' !== $first && 'null' !== $first && '{}' !== $first;
		}
		set_transient( self::TRANSIENT_PREFIX . 'theme_' . $slug, $ok ? 'yes' : 'no', self::TRANSIENT_TTL );
		return $ok;
	}

	public static function wp_org_url_for_plugin( $slug, $locale_or_code ) {
		$slug = sanitize_key( $slug );
		// translate.wordpress.org uses locale codes like es/ but the project
		// path tolerates both — pass through whatever the caller gives us.
		$path_lang = strtolower( str_replace( '_', '-', (string) $locale_or_code ) );
		return "https://translate.wordpress.org/projects/wp-plugins/{$slug}/dev/{$path_lang}/default/";
	}

	public static function wp_org_url_for_theme( $slug, $locale_or_code ) {
		$slug      = sanitize_key( $slug );
		$path_lang = strtolower( str_replace( '_', '-', (string) $locale_or_code ) );
		return "https://translate.wordpress.org/projects/wp-themes/{$slug}/{$path_lang}/default/";
	}
}

<?php
namespace GemTranslate\Routing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;

/**
 * First-visit redirect based on detected country.
 *
 * Mirrors BrowserRedirect but uses CountryContext (CloudFlare/MaxMind/cookie
 * waterfall) as the signal instead of `Accept-Language`. Country is a
 * stronger personalisation signal — a French-speaking visitor in Quebec
 * probably wants the Canadian site, not just any French site.
 *
 * Runs BEFORE BrowserRedirect (template_redirect priority 0 vs 1) so that
 * country-based decisions take precedence when both signals are available.
 *
 * Always persists the detected country to `gtrans_user_country` cookie,
 * regardless of whether a language redirect actually fires — this is how the
 * cookie detector picks up the value on subsequent requests.
 */
class CountryRedirector {

	public static function init() {
		// Persist the detected country every request once geo is enabled, even
		// on default-language URLs and even when no redirect is configured.
		add_action( 'template_redirect', [ __CLASS__, 'persist_country_cookie' ], 0 );

		// Country-driven language redirect, opt-in via geo_auto_redirect_country.
		add_action( 'template_redirect', [ __CLASS__, 'maybe_redirect' ], 0 );
	}

	public static function persist_country_cookie() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		if ( ! CountryContext::enabled() ) {
			return;
		}
		$iso = CountryContext::current();
		if ( '' === $iso ) {
			return;
		}
		// Don't clobber an existing cookie with the same value.
		if ( isset( $_COOKIE[ CountryContext::COOKIE ] )
			&& strtoupper( (string) $_COOKIE[ CountryContext::COOKIE ] ) === $iso
		) {
			return;
		}
		CountryContext::write_cookie( $iso );
	}

	public static function maybe_redirect() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		if ( ! CountryContext::enabled() ) {
			return;
		}
		$settings = CountryContext::settings();
		if ( empty( $settings['geo_auto_redirect_country'] ) ) {
			return;
		}
		// Skip crawlers (same heuristic as BrowserRedirect).
		if ( self::is_bot() ) {
			return;
		}
		// Already on a non-default language URL? Leave it alone.
		if ( ! Context::is_default() ) {
			return;
		}
		// Already chose a language? Respect the cookie (BrowserRedirect handles it).
		if ( isset( $_COOKIE[ BrowserRedirect::COOKIE ] ) ) {
			return;
		}
		$country = CountryContext::current();
		if ( '' === $country ) {
			return;
		}
		$lang = self::language_for_country( $country );
		if ( '' === $lang || $lang === Context::default_code() ) {
			return;
		}
		self::redirect_to( $lang );
	}

	private static function language_for_country( $iso ) {
		$iso = strtoupper( $iso );
		foreach ( Context::active_languages() as $code => $row ) {
			$codes = self::decode_country_codes( $row['country_codes'] ?? '' );
			if ( in_array( $iso, $codes, true ) ) {
				return (string) $code;
			}
		}
		return '';
	}

	private static function decode_country_codes( $raw ) {
		if ( is_array( $raw ) ) {
			$value = $raw;
		} else {
			$decoded = json_decode( (string) $raw, true );
			$value   = is_array( $decoded ) ? $decoded : [];
		}
		$out = [];
		foreach ( $value as $code ) {
			$code = strtoupper( trim( (string) $code ) );
			if ( preg_match( '/^[A-Z]{2}$/', $code ) ) {
				$out[] = $code;
			}
		}
		return $out;
	}

	private static function redirect_to( $lang ) {
		$path      = $_SERVER['REQUEST_URI'] ?? '/';
		$home_path = (string) ( wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/' );
		$relative  = preg_replace( '#^' . preg_quote( $home_path, '#' ) . '#', '/', (string) $path );
		$relative  = '/' . ltrim( $relative, '/' );
		$target    = home_url( '/' . $lang . $relative );

		// Write the language cookie so BrowserRedirect doesn't bounce the
		// visitor back on subsequent visits.
		if ( ! headers_sent() ) {
			setcookie( BrowserRedirect::COOKIE, sanitize_key( $lang ), time() + ( 30 * DAY_IN_SECONDS ), COOKIEPATH ?: '/', COOKIE_DOMAIN ?: '' );
		}
		wp_safe_redirect( $target, 302 );
		exit;
	}

	private static function is_bot() {
		$ua = strtolower( (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) );
		if ( '' === $ua ) {
			return false;
		}
		foreach ( [ 'bot', 'crawler', 'spider', 'facebookexternalhit', 'slurp', 'duckduckgo' ] as $t ) {
			if ( false !== strpos( $ua, $t ) ) {
				return true;
			}
		}
		return false;
	}
}

<?php
namespace GemTranslate\Language;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Geo\CloudflareDetector;
use GemTranslate\Geo\CookieDetector;
use GemTranslate\Geo\MaxmindDetector;

/**
 * Holds the visitor's resolved country code for the current request.
 *
 * Resolution order is configurable via `settings.geo_sources` (an ordered list
 * of detector keys). Each detector returns an ISO-3166 alpha-2 code or '' when
 * it can't decide. The first non-empty answer wins.
 *
 * Built-in detectors:
 *   - cf_header  → CloudFlare's `CF-IPCountry` request header
 *   - maxmind    → MaxMind GeoLite2 DB lookup against REMOTE_ADDR
 *   - cookie     → `gtrans_user_country` cookie (manual override / fallback)
 */
class CountryContext {

	const COOKIE = 'gtrans_user_country';

	private static $current = null;

	public static function set( $iso ) {
		self::$current = self::normalize( $iso );
	}

	public static function current() {
		if ( null === self::$current ) {
			self::$current = self::detect();
		}
		return (string) self::$current;
	}

	public static function flush() {
		self::$current = null;
	}

	/**
	 * Walk the configured detector chain. Memoized via current().
	 *
	 * @return string ISO code or ''.
	 */
	public static function detect() {
		if ( ! self::enabled() ) {
			return '';
		}
		foreach ( self::sources() as $key ) {
			$detector = self::detector_for( $key );
			if ( ! $detector ) {
				continue;
			}
			$iso = self::normalize( $detector->detect() );
			if ( '' !== $iso ) {
				return $iso;
			}
		}
		return '';
	}

	public static function enabled() {
		$settings = self::settings();
		return ! empty( $settings['geo_enabled'] );
	}

	/**
	 * @return string[] Ordered detector keys.
	 */
	public static function sources() {
		$settings = self::settings();
		$value    = $settings['geo_sources'] ?? [ 'cf_header', 'maxmind', 'cookie' ];
		if ( is_string( $value ) ) {
			$value = array_map( 'trim', explode( ',', $value ) );
		}
		if ( ! is_array( $value ) ) {
			$value = [ 'cf_header', 'maxmind', 'cookie' ];
		}
		return array_values( array_filter( array_map( 'strval', $value ) ) );
	}

	public static function settings() {
		$raw = get_option( GTRANS_SETTINGS_NAME, '{}' );
		$cfg = json_decode( $raw, true );
		return is_array( $cfg ) ? $cfg : [];
	}

	private static function detector_for( $key ) {
		switch ( $key ) {
			case 'cf_header':
				return new CloudflareDetector();
			case 'maxmind':
				$settings = self::settings();
				return new MaxmindDetector( (string) ( $settings['geo_maxmind_db_path'] ?? '' ) );
			case 'cookie':
				return new CookieDetector( self::COOKIE );
		}
		return null;
	}

	public static function normalize( $iso ) {
		$iso = strtoupper( trim( (string) $iso ) );
		return preg_match( '/^[A-Z]{2}$/', $iso ) ? $iso : '';
	}

	/**
	 * Persist a manually-chosen country in the visitor's browser. Used by the
	 * REST endpoint that powers the manual picker banner.
	 */
	public static function write_cookie( $iso ) {
		if ( headers_sent() ) {
			return false;
		}
		$iso = self::normalize( $iso );
		if ( '' === $iso ) {
			return false;
		}
		$settings = self::settings();
		$ttl_days = (int) ( $settings['geo_cookie_ttl_days'] ?? 90 );
		$ttl_days = max( 1, min( 3650, $ttl_days ) );
		setcookie(
			self::COOKIE,
			$iso,
			[
				'expires'  => time() + ( $ttl_days * DAY_IN_SECONDS ),
				'path'     => COOKIEPATH ?: '/',
				'domain'   => COOKIE_DOMAIN ?: '',
				'secure'   => is_ssl(),
				'samesite' => 'Lax',
			]
		);
		self::set( $iso );
		return true;
	}
}

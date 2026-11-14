<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;

/**
 * Geo / country detection REST endpoints.
 *
 * - GET  /gtrans/v1/geo/detect  → run the detector chain, return what was found
 * - POST /gtrans/v1/geo/cookie  → manually set the country cookie (picker UI)
 *
 * Both endpoints are public — they only echo geo state and don't mutate
 * server-side data.
 */
class Geo extends Controller {

	protected $rest_base = 'geo';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/detect',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'detect' ],
				'permission_callback' => '__return_true',
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/diagnose',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'diagnose' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/cookie',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'set_cookie' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	public function detect( $request ) {
		$iso = CountryContext::current();
		// Detector configuration is not exposed: it tells an attacker which
		// signals (headers, MaxMind, cookie) decide the visitor's content.
		return $this->ok(
			[
				'country'        => $iso,
				'enabled'        => CountryContext::enabled(),
				'language_match' => '' !== $iso ? $this->match_language( $iso ) : '',
			]
		);
	}

	/**
	 * Admin-only: why is (or isn't) the visitor's country being detected?
	 * Reports what the origin actually sees and what each detector answers,
	 * plus the language ↔ country mapping the auto-redirect depends on.
	 */
	public function diagnose( $request ) {
		$settings = CountryContext::settings();
		$peer     = (string) ( $_SERVER['REMOTE_ADDR'] ?? '' );
		$cf       = strtoupper( trim( (string) ( $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '' ) ) );
		$db_path  = (string) ( $settings['geo_maxmind_db_path'] ?? '' );

		$detectors = [];
		foreach ( CountryContext::sources() as $key ) {
			$detector = CountryContext::detector_for( $key );
			$detectors[ $key ] = $detector ? CountryContext::normalize( $detector->detect() ) : null;
		}

		$languages = [];
		foreach ( Context::active_languages() as $code => $row ) {
			$raw = $row['country_codes'] ?? '';
			if ( is_string( $raw ) ) {
				$decoded = json_decode( $raw, true );
				$raw     = is_array( $decoded ) ? $decoded : [];
			}
			$languages[ $code ] = array_values( (array) $raw );
		}

		$hints = [];
		if ( ! CountryContext::enabled() ) {
			$hints[] = 'Country detection is disabled (geo_enabled).';
		}
		if ( '' === $cf ) {
			$hints[] = 'No CF-IPCountry header reached PHP. Not behind Cloudflare, or IP Geolocation is off in Cloudflare → Network.';
		} elseif ( ! \GemTranslate\Geo\TrustedProxy::is_trusted_peer() ) {
			$hints[] = 'CF-IPCountry is present but REMOTE_ADDR (' . $peer . ') is not a trusted proxy, so it is ignored. If the server rewrites REMOTE_ADDR to the visitor IP, enable "Trust proxy headers"; otherwise add the proxy to geo_trusted_proxies.';
		}
		if ( '' === $db_path ) {
			$hints[] = 'MaxMind database path is not set.';
		} elseif ( ! is_readable( $db_path ) ) {
			$hints[] = 'MaxMind database file is not readable at the configured path.';
		} elseif ( ! class_exists( '\\GeoIp2\\Database\\Reader' ) && ! class_exists( '\\MaxMind\\Db\\Reader' ) ) {
			$hints[] = 'MaxMind reader library (geoip2/geoip2 or maxmind-db/reader) is not installed.';
		}
		if ( ! array_filter( $languages ) ) {
			$hints[] = 'No language has country codes, so the country → language redirect can never match.';
		}

		return $this->ok(
			[
				'enabled'          => CountryContext::enabled(),
				'country'          => CountryContext::current(),
				'sources'          => CountryContext::sources(),
				'detectors'        => $detectors,
				'remote_addr'      => $peer,
				'peer_trusted'     => \GemTranslate\Geo\TrustedProxy::is_trusted_peer(),
				'trust_headers'    => ! empty( $settings['geo_trust_proxy_headers'] ),
				'cf_ipcountry'     => $cf,
				'cf_connecting_ip' => (string) ( $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '' ),
				'client_ip'        => \GemTranslate\Geo\TrustedProxy::client_ip(),
				'maxmind_path_set' => '' !== $db_path,
				'languages'        => $languages,
				'hints'            => $hints,
			]
		);
	}

	/** Cookie writes allowed per client per window. */
	const COOKIE_RATE_LIMIT  = 20;
	const COOKIE_RATE_WINDOW = MINUTE_IN_SECONDS;

	public function set_cookie( $request ) {
		if ( ! CountryContext::enabled() ) {
			return $this->fail( 'gtrans_geo_disabled', __( 'Country detection is not enabled.', 'gemtranslate' ), 404 );
		}
		if ( $this->rate_limited() ) {
			return $this->fail( 'gtrans_rate_limited', __( 'Too many requests. Try again in a minute.', 'gemtranslate' ), 429 );
		}
		$body    = $request->get_json_params() ?: $request->get_params();
		$country = strtoupper( (string) ( $body['country'] ?? '' ) );
		if ( ! preg_match( '/^[A-Z]{2}$/', $country ) ) {
			return $this->fail( 'gtrans_invalid_country', __( 'country must be an ISO 3166-1 alpha-2 code.', 'gemtranslate' ), 422 );
		}
		$ok = CountryContext::write_cookie( $country );
		if ( ! $ok ) {
			return $this->fail( 'gtrans_cookie_failed', __( 'Could not set country cookie.', 'gemtranslate' ), 500 );
		}
		return $this->ok( [ 'country' => $country ] );
	}

	/**
	 * Fixed-window counter per client IP. The endpoint is public by design (it
	 * backs the country picker for anonymous visitors), so it must not be an
	 * unlimited write path.
	 */
	private function rate_limited() {
		$ip  = \GemTranslate\Geo\TrustedProxy::client_ip();
		$key = 'gtrans_geo_rl_' . md5( '' !== $ip ? $ip : 'unknown' );
		$n   = (int) get_transient( $key );
		if ( $n >= self::COOKIE_RATE_LIMIT ) {
			return true;
		}
		set_transient( $key, $n + 1, self::COOKIE_RATE_WINDOW );
		return false;
	}

	private function match_language( $country ) {
		foreach ( Context::active_languages() as $code => $row ) {
			$raw = $row['country_codes'] ?? '';
			if ( is_string( $raw ) ) {
				$decoded = json_decode( $raw, true );
				$raw     = is_array( $decoded ) ? $decoded : [];
			}
			foreach ( (array) $raw as $iso ) {
				if ( strtoupper( (string) $iso ) === $country ) {
					return (string) $code;
				}
			}
		}
		return '';
	}
}

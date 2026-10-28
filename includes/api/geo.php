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

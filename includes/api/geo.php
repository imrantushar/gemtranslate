<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Language\CountryContext;

/**
 * Geo / country detection REST endpoints.
 *
 * - GET  /ztrans/v1/geo/detect  → run the detector chain, return what was found
 * - POST /ztrans/v1/geo/cookie  → manually set the country cookie (picker UI)
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
		return $this->ok(
			[
				'country'        => $iso,
				'enabled'        => CountryContext::enabled(),
				'sources'        => CountryContext::sources(),
				'language_match' => '' !== $iso ? $this->match_language( $iso ) : '',
			]
		);
	}

	public function set_cookie( $request ) {
		$body    = $request->get_json_params() ?: $request->get_params();
		$country = strtoupper( (string) ( $body['country'] ?? '' ) );
		if ( ! preg_match( '/^[A-Z]{2}$/', $country ) ) {
			return $this->fail( 'ztrans_invalid_country', __( 'country must be an ISO 3166-1 alpha-2 code.', 'zentranslate' ), 422 );
		}
		$ok = CountryContext::write_cookie( $country );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_cookie_failed', __( 'Could not set country cookie.', 'zentranslate' ), 500 );
		}
		return $this->ok( [ 'country' => $country ] );
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

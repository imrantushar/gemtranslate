<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\I18n\PackGenerator;

class I18n extends Controller {

	protected $rest_base = 'i18n';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packs',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'status' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'generate' ],
					'permission_callback' => [ $this, 'permissions_check' ],
					'args'                => [
						'target_lang' => [ 'type' => 'string', 'required' => true ],
						'locale'      => [ 'type' => 'string', 'required' => true ],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packs/(?P<locale>[a-zA-Z0-9_\-]+)',
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);
	}

	public function status() {
		return $this->ok( PackGenerator::status() );
	}

	public function generate( $request ) {
		$body        = $request->get_json_params() ?: $request->get_params();
		$target_lang = (string) ( $body['target_lang'] ?? '' );
		$locale      = (string) ( $body['locale'] ?? '' );
		if ( '' === $target_lang || '' === $locale ) {
			return $this->fail( 'ztrans_invalid', __( 'target_lang and locale are required.', 'zentranslate' ), 422 );
		}
		// Lift execution limits — translating ~300 strings can take ~30s.
		@set_time_limit( 300 );

		$result = PackGenerator::generate( $target_lang, $locale );
		if ( is_wp_error( $result ) ) {
			return $this->fail( $result->get_error_code(), $result->get_error_message(), 422 );
		}
		return $this->ok( $result );
	}

	public function delete( $request ) {
		$locale  = (string) $request['locale'];
		$removed = PackGenerator::delete( $locale );
		return $this->ok( [ 'removed' => $removed, 'locale' => $locale ] );
	}
}

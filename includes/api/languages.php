<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\LanguageRegistry;

class Languages extends Controller {

	protected $rest_base = 'languages';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'index' ],
					'permission_callback' => [ $this, 'permissions_check' ],
					'args'                => [
						'active' => [
							'type'        => 'boolean',
							'description' => __( 'If true, only return active languages.', 'gemtranslate' ),
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create' ],
					'permission_callback' => [ $this, 'permissions_check' ],
					'args'                => $this->writable_args( true ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<code>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update' ],
					'permission_callback' => [ $this, 'permissions_check' ],
					'args'                => $this->writable_args( false ),
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'destroy' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<code>[a-z0-9\-]{2,10})/default',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'set_default' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);
	}

	public function index( $request ) {
		$registry = new LanguageRegistry();
		$only_active = (bool) $request->get_param( 'active' );
		$rows = $registry->all( $only_active );
		return $this->ok( array_map( [ $this, 'prepare_row' ], $rows ), [ 'total' => count( $rows ) ] );
	}

	public function show( $request ) {
		$registry = new LanguageRegistry();
		$row = $registry->get( $request['code'] );
		if ( ! $row ) {
			return $this->fail( 'gtrans_not_found', __( 'Language not found.', 'gemtranslate' ), 404 );
		}
		return $this->ok( $this->prepare_row( $row ) );
	}

	public function create( $request ) {
		$registry = new LanguageRegistry();
		$params = $request->get_json_params() ?: $request->get_params();

		if ( empty( $params['code'] ) || empty( $params['locale'] ) || empty( $params['name'] ) ) {
			return $this->fail( 'gtrans_invalid', __( 'code, locale, and name are required.', 'gemtranslate' ), 422 );
		}
		if ( $registry->get( strtolower( $params['code'] ) ) ) {
			return $this->fail( 'gtrans_duplicate', __( 'A language with that code already exists.', 'gemtranslate' ), 409 );
		}

		$code = $registry->insert( $params );
		if ( ! $code ) {
			return $this->fail( 'gtrans_insert_failed', __( 'Could not save language.', 'gemtranslate' ), 500 );
		}

		return $this->ok( $this->prepare_row( $registry->get( $code ) ), [], 201 );
	}

	public function update( $request ) {
		$registry = new LanguageRegistry();
		$code = $request['code'];

		if ( ! $registry->get( $code ) ) {
			return $this->fail( 'gtrans_not_found', __( 'Language not found.', 'gemtranslate' ), 404 );
		}

		$params = $request->get_json_params() ?: $request->get_params();
		$ok = $registry->update( $code, $params );
		if ( ! $ok ) {
			return $this->fail( 'gtrans_update_failed', __( 'No changes applied.', 'gemtranslate' ), 400 );
		}

		return $this->ok( $this->prepare_row( $registry->get( $code ) ) );
	}

	public function destroy( $request ) {
		$registry = new LanguageRegistry();
		$code = $request['code'];
		$row = $registry->get( $code );
		if ( ! $row ) {
			return $this->fail( 'gtrans_not_found', __( 'Language not found.', 'gemtranslate' ), 404 );
		}
		if ( (int) $row['is_default'] === 1 ) {
			return $this->fail( 'gtrans_default_locked', __( 'Cannot delete the default language.', 'gemtranslate' ), 422 );
		}
		$registry->delete( $code );
		return $this->ok( [ 'deleted' => true, 'code' => $code ] );
	}

	public function set_default( $request ) {
		$registry = new LanguageRegistry();
		$code = $request['code'];
		if ( ! $registry->get( $code ) ) {
			return $this->fail( 'gtrans_not_found', __( 'Language not found.', 'gemtranslate' ), 404 );
		}
		$registry->set_default( $code );
		return $this->ok( $this->prepare_row( $registry->get( $code ) ) );
	}

	private function prepare_row( $row ) {
		if ( ! $row ) {
			return null;
		}
		$country_codes = $row['country_codes'] ?? '';
		if ( is_string( $country_codes ) && '' !== $country_codes ) {
			$decoded = json_decode( $country_codes, true );
			$country_codes = is_array( $decoded ) ? $decoded : [];
		} elseif ( ! is_array( $country_codes ) ) {
			$country_codes = [];
		}
		return [
			'code'          => $row['code'],
			'locale'        => $row['locale'],
			'name'          => $row['name'],
			'native_name'   => $row['native_name'],
			'flag'          => $row['flag'],
			'is_rtl'        => (bool) $row['is_rtl'],
			'is_default'    => (bool) $row['is_default'],
			'active'        => (bool) $row['active'],
			'position'      => (int) $row['position'],
			'country_codes' => $country_codes,
		];
	}

	private function writable_args( $require_required ) {
		$args = [
			'code'          => [ 'type' => 'string', 'required' => $require_required ],
			'locale'        => [ 'type' => 'string', 'required' => $require_required ],
			'name'          => [ 'type' => 'string', 'required' => $require_required ],
			'native_name'   => [ 'type' => 'string' ],
			'flag'          => [ 'type' => 'string' ],
			'is_rtl'        => [ 'type' => 'boolean' ],
			'active'        => [ 'type' => 'boolean' ],
			'position'      => [ 'type' => 'integer' ],
			'country_codes' => [ 'type' => 'array' ],
		];
		return $args;
	}
}

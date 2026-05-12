<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Admin\LanguageScope;

/**
 * REST surface for managing translator users and their language scope.
 */
class Translators extends Controller {

	protected $rest_base = 'translators';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/languages',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);
	}

	public function index() {
		$users = get_users( [
			'capability__in' => [ 'ztrans_translate_content' ],
			'orderby'        => 'display_name',
			'order'          => 'ASC',
			'number'         => 200,
		] );
		$rows = [];
		foreach ( $users as $u ) {
			$rows[] = [
				'id'         => (int) $u->ID,
				'name'       => $u->display_name,
				'email'      => $u->user_email,
				'roles'      => array_values( (array) $u->roles ),
				'languages'  => LanguageScope::for_user( $u->ID ),
				'unrestricted' => empty( LanguageScope::for_user( $u->ID ) ),
			];
		}
		return $this->ok( $rows );
	}

	public function show( $request ) {
		$user_id = (int) $request['id'];
		$user    = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return $this->fail( 'ztrans_not_found', __( 'User not found.', 'zentranslate' ), 404 );
		}
		return $this->ok( [
			'id'        => $user_id,
			'name'      => $user->display_name,
			'languages' => LanguageScope::for_user( $user_id ),
		] );
	}

	public function update( $request ) {
		$user_id = (int) $request['id'];
		$user    = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return $this->fail( 'ztrans_not_found', __( 'User not found.', 'zentranslate' ), 404 );
		}
		$body  = $request->get_json_params() ?: $request->get_params();
		$codes = (array) ( $body['languages'] ?? [] );
		LanguageScope::set_for_user( $user_id, $codes );
		return $this->show( $request );
	}
}

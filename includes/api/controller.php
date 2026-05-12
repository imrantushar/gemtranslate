<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Abstract REST controller. All Zentranslate REST endpoints inherit from this.
 */
abstract class Controller {

	protected $namespace = ZTRANS_REST_NAMESPACE;
	protected $rest_base = '';

	abstract public function register_routes();

	/**
	 * Default permission: manage_options. Subclasses can override.
	 */
	public function permissions_check( $request ) {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		return new \WP_Error(
			'ztrans_forbidden',
			__( 'You do not have permission to perform this action.', 'zentranslate' ),
			[ 'status' => rest_authorization_required_code() ]
		);
	}

	/**
	 * Standard success response envelope.
	 *
	 * @param mixed $data
	 * @param array $meta
	 * @param int   $status
	 * @return \WP_REST_Response
	 */
	protected function ok( $data, $meta = [], $status = 200 ) {
		return new \WP_REST_Response(
			[
				'data'   => $data,
				'meta'   => $meta,
				'errors' => [],
			],
			$status
		);
	}

	protected function fail( $code, $message, $status = 400, $data = [] ) {
		return new \WP_Error( $code, $message, array_merge( [ 'status' => $status ], $data ) );
	}
}

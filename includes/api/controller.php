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

	const CAP_TRANSLATE = 'ztrans_translate_content';

	/**
	 * Admin-only permission. Used for managing languages, AI provider
	 * credentials, plugin settings — anything where leaking creds or
	 * destabilising the site matters.
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
	 * Translator permission. Used for translation surfaces (posts, terms,
	 * menus, strings, SEO) so editors with the `ztrans_translate_content`
	 * cap can work without being granted full admin rights.
	 */
	public function permissions_translate( $request ) {
		if ( current_user_can( self::CAP_TRANSLATE ) || current_user_can( 'manage_options' ) ) {
			// If the URL carries a `:lang` segment, enforce language scope.
			if ( $request instanceof \WP_REST_Request ) {
				$lang = $request->get_param( 'lang' );
				if ( $lang && ! \Zentranslate\Admin\LanguageScope::can_translate( $lang ) ) {
					return new \WP_Error(
						'ztrans_lang_scope',
						__( 'You are not assigned to translate this language.', 'zentranslate' ),
						[ 'status' => rest_authorization_required_code() ]
					);
				}
			}
			return true;
		}
		return new \WP_Error(
			'ztrans_forbidden',
			__( 'You do not have permission to translate content.', 'zentranslate' ),
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

<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Abstract REST controller. All GemTranslate REST endpoints inherit from this.
 */
abstract class Controller {

	protected $namespace = GTRANS_REST_NAMESPACE;
	protected $rest_base = '';

	abstract public function register_routes();

	const CAP_TRANSLATE = 'gtrans_translate_content';

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
			'gtrans_forbidden',
			__( 'You do not have permission to perform this action.', 'gemtranslate' ),
			[ 'status' => rest_authorization_required_code() ]
		);
	}

	/**
	 * Translator permission. Used for translation surfaces (posts, terms,
	 * menus, strings, SEO) so editors with the `gtrans_translate_content`
	 * cap can work without being granted full admin rights.
	 */
	public function permissions_translate( $request ) {
		if ( current_user_can( self::CAP_TRANSLATE ) || current_user_can( 'manage_options' ) ) {
			// If the URL carries a `:lang` segment, enforce language scope.
			if ( $request instanceof \WP_REST_Request ) {
				$lang = $request->get_param( 'lang' );
				if ( $lang && ! \GemTranslate\Admin\LanguageScope::can_translate( $lang ) ) {
					return new \WP_Error(
						'gtrans_lang_scope',
						__( 'You are not assigned to translate this language.', 'gemtranslate' ),
						[ 'status' => rest_authorization_required_code() ]
					);
				}
			}
			return true;
		}
		return new \WP_Error(
			'gtrans_forbidden',
			__( 'You do not have permission to translate content.', 'gemtranslate' ),
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

	/**
	 * Guard a Pro-only endpoint. Returns a WP_Error when the feature is
	 * unavailable (gemtranslate-pro inactive / unlicensed), else null so the
	 * caller proceeds. React hides these surfaces via `window.gtrans.features`,
	 * so this is a defense-in-depth backstop for direct API calls.
	 *
	 * @param string $feature Flag key from gtrans_feature_flags().
	 * @return \WP_Error|null
	 */
	protected function require_pro( $feature ) {
		if ( gtrans_feature( $feature ) ) {
			return null;
		}
		return $this->fail(
			'gtrans_pro_required',
			__( 'This is a GemTranslate Pro feature.', 'gemtranslate' ),
			402,
			[ 'feature' => $feature, 'upgrade' => true ]
		);
	}
}

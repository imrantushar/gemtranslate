<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Settings extends Controller {

	protected $rest_base = 'settings';

	const ALLOWED_KEYS = [
		'url_strategy',
		'hide_default_lang_prefix',
		'show_switcher_for_default',
		'object_cache_enabled',
		'debug_log_enabled',
		'remove_data_on_uninstall',
		'onboarding_complete',
		'auto_redirect_browser_lang',
		'translate_emails',
	];

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

		// Current-user preference. Any logged-in user can set their own
		// admin language; permission_check just verifies they're logged in.
		register_rest_route(
			$this->namespace,
			'/me/language',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show_my_language' ],
					'permission_callback' => [ $this, 'me_permissions' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_my_language' ],
					'permission_callback' => [ $this, 'me_permissions' ],
				],
			]
		);
	}

	public function me_permissions() {
		if ( is_user_logged_in() ) {
			return true;
		}
		return new \WP_Error( 'ztrans_unauth', __( 'Login required.', 'zentranslate' ), [ 'status' => 401 ] );
	}

	public function show_my_language() {
		$user_id = get_current_user_id();
		return $this->ok(
			[
				'language' => (string) get_user_meta( $user_id, \Zentranslate\Admin\ProfileField::META_KEY, true ),
			]
		);
	}

	public function update_my_language( $request ) {
		$user_id = get_current_user_id();
		$body    = $request->get_json_params() ?: $request->get_params();
		$lang    = isset( $body['language'] ) ? sanitize_key( $body['language'] ) : '';

		if ( '' === $lang ) {
			delete_user_meta( $user_id, \Zentranslate\Admin\ProfileField::META_KEY );
		} elseif ( \Zentranslate\Language\Context::is_active( $lang ) ) {
			update_user_meta( $user_id, \Zentranslate\Admin\ProfileField::META_KEY, $lang );
		} else {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}

		return $this->show_my_language();
	}

	public function show() {
		return $this->ok( $this->merged() );
	}

	public function update( $request ) {
		$body    = $request->get_json_params() ?: $request->get_params();
		$merged  = $this->merged();
		foreach ( self::ALLOWED_KEYS as $key ) {
			if ( array_key_exists( $key, $body ) ) {
				$merged[ $key ] = $body[ $key ];
			}
		}
		update_option( ZTRANS_SETTINGS_NAME, wp_json_encode( $merged ) );
		// Refresh global settings cache for the rest of this request.
		$GLOBALS['ztrans_settings'] = (object) $merged;
		return $this->ok( $merged );
	}

	private function merged() {
		$defaults = [
			'url_strategy'             => 'subdirectory',
			'hide_default_lang_prefix' => true,
			'show_switcher_for_default' => true,
			'object_cache_enabled'     => true,
			'debug_log_enabled'        => false,
			'remove_data_on_uninstall' => false,
			'onboarding_complete'      => false,
			'auto_redirect_browser_lang' => false,
			'translate_emails'          => false,
		];
		$saved = json_decode( get_option( ZTRANS_SETTINGS_NAME, '{}' ), true );
		if ( ! is_array( $saved ) ) {
			$saved = [];
		}
		return array_merge( $defaults, $saved );
	}
}

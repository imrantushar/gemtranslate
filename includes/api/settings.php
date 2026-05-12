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
		];
		$saved = json_decode( get_option( ZTRANS_SETTINGS_NAME, '{}' ), true );
		if ( ! is_array( $saved ) ) {
			$saved = [];
		}
		return array_merge( $defaults, $saved );
	}
}

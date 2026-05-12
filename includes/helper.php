<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Helper {

	public static function table( $name ) {
		return ztrans_table( $name );
	}

	public static function get_settings( $key, $default = null ) {
		return ztrans_get_setting( $key, $default );
	}

	public static function flush_rewrite_rules() {
		ztrans_flush_rewrite_rules();
	}

	public static function get_time() {
		return current_time( 'mysql', true );
	}

	public static function is_request( $type ) {
		switch ( $type ) {
			case 'admin':
				return is_admin();
			case 'ajax':
				return defined( 'DOING_AJAX' );
			case 'cron':
				return defined( 'DOING_CRON' );
			case 'rest':
				return defined( 'REST_REQUEST' );
			case 'frontend':
				return ( ! is_admin() || defined( 'DOING_AJAX' ) ) && ! defined( 'DOING_CRON' ) && ! defined( 'REST_REQUEST' );
		}
		return false;
	}
}

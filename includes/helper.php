<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Helper {

	public static function table( $name ) {
		return gtrans_table( $name );
	}

	public static function get_settings( $key, $default = null ) {
		return gtrans_get_setting( $key, $default );
	}

	public static function flush_rewrite_rules() {
		gtrans_flush_rewrite_rules();
	}

	public static function get_time() {
		return current_time( 'mysql', true );
	}

	/**
	 * Read a bookkeeping value stored under gtrans_settings._meta.
	 * Replaces the old scattered gtrans_* option rows.
	 */
	public static function meta_get( $key, $default = null ) {
		$settings = json_decode( get_option( GTRANS_SETTINGS_NAME, '{}' ), true );
		if ( ! is_array( $settings ) || empty( $settings['_meta'][ $key ] ) ) {
			return $default;
		}
		return $settings['_meta'][ $key ];
	}

	/**
	 * Write a bookkeeping value into gtrans_settings._meta.
	 */
	public static function meta_set( $key, $value ) {
		$settings = json_decode( get_option( GTRANS_SETTINGS_NAME, '{}' ), true );
		if ( ! is_array( $settings ) ) {
			$settings = [];
		}
		if ( ! isset( $settings['_meta'] ) || ! is_array( $settings['_meta'] ) ) {
			$settings['_meta'] = [];
		}
		$settings['_meta'][ $key ] = $value;
		update_option( GTRANS_SETTINGS_NAME, wp_json_encode( $settings ) );
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

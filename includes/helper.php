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
	 * Sanitise markup supplied by a translator before it is stored.
	 *
	 * Translations are rendered on the front end as-is, so anything stored here
	 * is as trusted as post content. The translator role has no
	 * `unfiltered_html`, so for those users the value goes through `wp_kses_post`
	 * — the same filtering core applies to a contributor's post. Users who may
	 * already publish unfiltered HTML, and WP-CLI (operator-run), are left alone.
	 *
	 * @param mixed $value Raw translator input.
	 * @return string
	 */
	public static function sanitize_markup( $value ) {
		$value = (string) $value;
		$trust_cli = (bool) apply_filters( 'gtrans_trust_cli_markup', defined( 'WP_CLI' ) && WP_CLI );
		if ( $trust_cli || current_user_can( 'unfiltered_html' ) ) {
			return $value;
		}
		return wp_kses_post( $value );
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

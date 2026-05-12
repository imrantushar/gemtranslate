<?php
/**
 * Global helper functions for Zentranslate.
 *
 * @package Zentranslate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'ztrans_table' ) ) {
	/**
	 * Get a fully-qualified Zentranslate table name (with site db prefix).
	 *
	 * @param string $name Short table name (e.g. 'languages').
	 * @return string
	 */
	function ztrans_table( $name ) {
		global $wpdb;
		return $wpdb->prefix . ZTRANS_DB_PREFIX . ltrim( $name, '_' );
	}
}

if ( ! function_exists( 'ztrans_get_setting' ) ) {
	/**
	 * Read a setting from the cached global settings blob.
	 *
	 * @param string $key     Setting key.
	 * @param mixed  $default Default value.
	 * @return mixed
	 */
	function ztrans_get_setting( $key, $default = null ) {
		if ( isset( $GLOBALS['ztrans_settings']->$key ) ) {
			return $GLOBALS['ztrans_settings']->$key;
		}
		return $default;
	}
}

if ( ! function_exists( 'ztrans_flush_rewrite_rules' ) ) {
	/**
	 * Schedule a rewrite-rules flush at the next `init`.
	 */
	function ztrans_flush_rewrite_rules() {
		update_option( 'ztrans_required_rewrite_flush', 'yes' );
	}
}

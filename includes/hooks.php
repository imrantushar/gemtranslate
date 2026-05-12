<?php
/**
 * Central hook wiring for Zentranslate.
 *
 * Anything that needs to fire before the main dispatcher (e.g., text domain loading,
 * schema upgrades) is wired here.
 *
 * @package Zentranslate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', 'ztrans_load_textdomain' );
add_action( 'init', 'ztrans_maybe_upgrade_schema' );

if ( ! function_exists( 'ztrans_load_textdomain' ) ) {
	function ztrans_load_textdomain() {
		load_plugin_textdomain(
			'zentranslate',
			false,
			dirname( ZTRANS_PLUGIN_BASENAME ) . '/languages/'
		);
	}
}

if ( ! function_exists( 'ztrans_maybe_upgrade_schema' ) ) {
	function ztrans_maybe_upgrade_schema() {
		Zentranslate\Database\Migrator::maybe_upgrade();
	}
}

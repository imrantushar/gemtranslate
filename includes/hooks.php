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
add_action( 'init', 'ztrans_maybe_grant_caps', 11 );

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

if ( ! function_exists( 'ztrans_maybe_grant_caps' ) ) {
	/**
	 * Grant translator cap to existing sites without re-activating. Tracked
	 * with a one-shot option so the role lookup runs only once.
	 */
	function ztrans_maybe_grant_caps() {
		if ( 'yes' === get_option( 'ztrans_caps_granted' ) ) {
			return;
		}
		( new Zentranslate\Installer() )->add_capabilities();
		update_option( 'ztrans_caps_granted', 'yes', false );
	}
}

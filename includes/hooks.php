<?php
/**
 * Central hook wiring for GemTranslate.
 *
 * Anything that needs to fire before the main dispatcher (e.g., text domain loading,
 * schema upgrades) is wired here.
 *
 * @package GemTranslate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', 'gtrans_load_textdomain' );
add_action( 'init', 'gtrans_maybe_upgrade_schema' );
add_action( 'init', 'gtrans_maybe_grant_caps', 11 );

if ( ! function_exists( 'gtrans_load_textdomain' ) ) {
	function gtrans_load_textdomain() {
		load_plugin_textdomain(
			'gemtranslate',
			false,
			dirname( GTRANS_PLUGIN_BASENAME ) . '/languages/'
		);
	}
}

if ( ! function_exists( 'gtrans_maybe_upgrade_schema' ) ) {
	function gtrans_maybe_upgrade_schema() {
		GemTranslate\Database\Migrator::maybe_upgrade();
	}
}

if ( ! function_exists( 'gtrans_maybe_grant_caps' ) ) {
	/**
	 * Grant translator cap to existing sites without re-activating. Tracked
	 * with a one-shot option so the role lookup runs only once.
	 */
	function gtrans_maybe_grant_caps() {
		if ( 'yes' === get_option( 'gtrans_caps_granted' ) ) {
			return;
		}
		( new GemTranslate\Installer() )->add_capabilities();
		update_option( 'gtrans_caps_granted', 'yes', false );
	}
}

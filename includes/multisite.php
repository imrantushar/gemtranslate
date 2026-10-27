<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Multisite hooks.
 *
 * - Installs the schema and seeds the default language for each new site
 *   created on the network.
 * - Cleans up tables when a site is deleted (and "remove all data" is on).
 *
 * Plays nicely with both network-wide activation and per-site activation
 * (in the latter case core's activation hook handles install; this only
 * runs the install for sites created *after* network activation).
 */
class Multisite {

	public static function init() {
		if ( ! is_multisite() ) {
			return;
		}
		// WP 5.1+ — fires after a new site is initialized.
		add_action( 'wp_initialize_site', [ __CLASS__, 'on_site_initialized' ], 10, 2 );
		// Older callback names — registered defensively.
		add_action( 'wpmu_new_blog', [ __CLASS__, 'on_legacy_new_blog' ] );

		add_action( 'wp_uninitialize_site', [ __CLASS__, 'on_site_deleted' ] );
	}

	public static function on_site_initialized( $new_site, $args ) {
		if ( ! is_plugin_active_for_network( GTRANS_PLUGIN_BASENAME ) ) {
			return;
		}
		self::install_for_site( (int) $new_site->blog_id );
	}

	public static function on_legacy_new_blog( $blog_id ) {
		if ( ! is_plugin_active_for_network( GTRANS_PLUGIN_BASENAME ) ) {
			return;
		}
		self::install_for_site( (int) $blog_id );
	}

	public static function on_site_deleted( $site ) {
		$blog_id = (int) $site->blog_id;
		switch_to_blog( $blog_id );
		try {
			$settings = json_decode( get_option( GTRANS_SETTINGS_NAME, '{}' ), true ) ?: [];
			if ( ! empty( $settings['remove_data_on_uninstall'] ) ) {
				self::drop_tables_for_current_site();
			}
		} finally {
			restore_current_blog();
		}
	}

	private static function install_for_site( $blog_id ) {
		switch_to_blog( $blog_id );
		try {
			Installer::init();
		} finally {
			restore_current_blog();
		}
	}

	private static function drop_tables_for_current_site() {
		global $wpdb;
		$prefix = $wpdb->prefix . 'gtrans_';
		$tables = [
			'languages', 'translation_groups', 'post_translations', 'term_translations',
			'menu_translations', 'strings', 'string_translations', 'seo_meta', 'slugs',
			'jobs', 'translation_memory', 'glossary', 'post_meta_translations',
		];
		foreach ( $tables as $t ) {
			$wpdb->query( "DROP TABLE IF EXISTS {$prefix}{$t}" );
		}
	}
}

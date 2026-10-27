<?php
/**
 * GemTranslate uninstaller.
 *
 * Runs only when the user deletes the plugin via WP admin. Drops all
 * GemTranslate tables and options when the "Remove all data on uninstall"
 * setting is enabled.
 *
 * @package GemTranslate
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$settings_json = get_option( 'gtrans_settings', '{}' );
$settings      = json_decode( $settings_json );
$remove_data   = isset( $settings->remove_data_on_uninstall ) ? (bool) $settings->remove_data_on_uninstall : false;

if ( ! $remove_data ) {
	return;
}

global $wpdb;
$prefix = $wpdb->prefix . 'gtrans_';
$tables = [
	'languages',
	'translation_groups',
	'post_translations',
	'term_translations',
	'menu_translations',
	'strings',
	'string_translations',
	'seo_meta',
	'slugs',
	'jobs',
	'translation_memory',
	'glossary',
];
foreach ( $tables as $name ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$prefix}{$name}" );
}

$options = [
	'gtrans_version',
	'gtrans_db_version',
	'gtrans_settings',
	'gtrans_first_install_time',
	'gtrans_required_rewrite_flush',
];
foreach ( $options as $option ) {
	delete_option( $option );
}

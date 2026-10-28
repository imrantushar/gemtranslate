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

require_once __DIR__ . '/includes/uninstaller.php';

/**
 * Honour the "Remove all data on uninstall" setting of a single site.
 */
$gtrans_uninstall_site = static function () {
	$settings    = json_decode( (string) get_option( 'gtrans_settings', '{}' ) );
	$remove_data = isset( $settings->remove_data_on_uninstall ) ? (bool) $settings->remove_data_on_uninstall : false;
	if ( $remove_data ) {
		\GemTranslate\Uninstaller::remove_current_site();
	}
};

if ( is_multisite() ) {
	// The setting is per site, so decide site by site.
	foreach ( get_sites( [ 'fields' => 'ids', 'number' => 0 ] ) as $gtrans_blog_id ) {
		switch_to_blog( (int) $gtrans_blog_id );
		$gtrans_uninstall_site();
		restore_current_blog();
	}
} else {
	$gtrans_uninstall_site();
}

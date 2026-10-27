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

if ( ! function_exists( 'ztrans_feature_flags' ) ) {
	/**
	 * The full map of Pro feature flags. Free ships them all `false`;
	 * zentranslate-pro flips them `true` via the `ztrans_feature_flags` filter
	 * (gated on `ztrans_pro_license_valid`). React reads this via
	 * `window.ztrans.features`; PHP reads individual flags via `ztrans_feature()`.
	 *
	 * @return array<string,bool>
	 */
	function ztrans_feature_flags() {
		$defaults = [
			'ai_bulk'             => false, // Bulk AI translation.
			'translate_everything' => false, // Auto-translate on publish + review queue.
			'translation_memory'  => false,
			'glossary'            => false,
			'woocommerce'         => false,
			'seo_advanced'        => false, // Yoast/RankMath bridges + per-translation meta.
			'country_variants'    => false,
			'custom_fields'       => false, // Custom fields / ACF translation.
			'revisions'           => false,
			'translators'         => false, // Translator management.
			'import_export'       => false, // XLIFF / CSV.
			'self_translation'    => false, // AI-translate the plugin admin.
			'email_locale'        => false, // Transactional email locale switch.
		];
		return (array) apply_filters( 'ztrans_feature_flags', $defaults );
	}
}

if ( ! function_exists( 'ztrans_feature' ) ) {
	/**
	 * Is a Pro feature available (Pro active + licensed)?
	 *
	 * @param string $key Flag key from {@see ztrans_feature_flags()}.
	 * @return bool
	 */
	function ztrans_feature( $key ) {
		$flags = ztrans_feature_flags();
		return ! empty( $flags[ $key ] );
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

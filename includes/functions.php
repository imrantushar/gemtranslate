<?php
/**
 * Global helper functions for GemTranslate.
 *
 * @package GemTranslate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'gtrans_table' ) ) {
	/**
	 * Get a fully-qualified GemTranslate table name (with site db prefix).
	 *
	 * @param string $name Short table name (e.g. 'languages').
	 * @return string
	 */
	function gtrans_table( $name ) {
		global $wpdb;
		return $wpdb->prefix . GTRANS_DB_PREFIX . ltrim( $name, '_' );
	}
}

if ( ! function_exists( 'gtrans_get_setting' ) ) {
	/**
	 * Read a setting from the cached global settings blob.
	 *
	 * @param string $key     Setting key.
	 * @param mixed  $default Default value.
	 * @return mixed
	 */
	function gtrans_get_setting( $key, $default = null ) {
		if ( isset( $GLOBALS['gtrans_settings']->$key ) ) {
			return $GLOBALS['gtrans_settings']->$key;
		}
		return $default;
	}
}

if ( ! function_exists( 'gtrans_feature_flags' ) ) {
	/**
	 * The full map of Pro feature flags. Free ships them all `false`;
	 * gemtranslate-pro flips them `true` via the `gtrans_feature_flags` filter
	 * (gated on `gtrans_pro_license_valid`). React reads this via
	 * `window.ztrans.features`; PHP reads individual flags via `gtrans_feature()`.
	 *
	 * @return array<string,bool>
	 */
	function gtrans_feature_flags() {
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
		return (array) apply_filters( 'gtrans_feature_flags', $defaults );
	}
}

if ( ! function_exists( 'gtrans_feature' ) ) {
	/**
	 * Is a Pro feature available (Pro active + licensed)?
	 *
	 * @param string $key Flag key from {@see gtrans_feature_flags()}.
	 * @return bool
	 */
	function gtrans_feature( $key ) {
		$flags = gtrans_feature_flags();
		return ! empty( $flags[ $key ] );
	}
}

if ( ! function_exists( 'gtrans_flush_rewrite_rules' ) ) {
	/**
	 * Schedule a rewrite-rules flush at the next `init`.
	 */
	function gtrans_flush_rewrite_rules() {
		\GemTranslate\Helper::meta_set( 'required_rewrite_flush', 'yes' );
	}
}

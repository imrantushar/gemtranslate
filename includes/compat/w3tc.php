<?php
namespace GemTranslate\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * W3 Total Cache bridge — flush cache on translation save / language change.
 */
class W3TC {

	public static function init() {
		if ( ! function_exists( 'w3tc_flush_all' ) ) {
			return;
		}
		add_action( 'gtrans_translation_saved', [ __CLASS__, 'flush' ] );
		add_action( 'gtrans_language_changed', [ __CLASS__, 'flush' ] );
	}

	public static function flush() {
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}
	}
}

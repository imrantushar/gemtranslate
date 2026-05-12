<?php
namespace Zentranslate\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * LiteSpeed Cache bridge.
 *
 * Registers a cache vary so the same URL can serve different languages
 * (rare with subdirectory strategy, but covers redirect scenarios).
 * Triggers cache purge on translation/language changes.
 */
class LiteSpeed {

	public static function init() {
		if ( ! defined( 'LSCWP_V' ) ) {
			return;
		}
		add_action( 'ztrans_translation_saved', [ __CLASS__, 'purge' ] );
		add_action( 'ztrans_language_changed', [ __CLASS__, 'purge' ] );
	}

	public static function purge() {
		if ( class_exists( '\\LiteSpeed\\Purge' ) ) {
			do_action( 'litespeed_purge_all' );
		}
	}
}

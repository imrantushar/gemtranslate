<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin wrapper around wp_cache_* so every read/write to the translation
 * cache goes through one surface. 24h TTL by default — invalidation is
 * event-driven via the Invalidator.
 */
class TranslationCache {

	const GROUP_POSTS = 'ztrans_translations';
	const GROUP_TERMS = 'ztrans_term_translations';
	const GROUP_STRINGS = 'ztrans_strings';
	const TTL = DAY_IN_SECONDS;

	public static function get( $group, $key ) {
		return wp_cache_get( $key, $group );
	}

	public static function set( $group, $key, $value ) {
		return wp_cache_set( $key, $value, $group, self::TTL );
	}

	public static function delete( $group, $key ) {
		return wp_cache_delete( $key, $group );
	}

	public static function flush_group( $group ) {
		// Falls back to no-op on object caches without group flush — rely on
		// per-key invalidation in the Invalidator.
		if ( function_exists( 'wp_cache_flush_group' ) ) {
			return wp_cache_flush_group( $group );
		}
		return false;
	}
}

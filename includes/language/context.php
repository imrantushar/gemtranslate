<?php
namespace Zentranslate\Language;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Holds the current request's language state.
 *
 * Set once early (during do_parse_request, before WordPress URL matching) and
 * read from many places (filters, URL builders, hreflang output). Static by
 * design — language is a per-request singleton, never plural within one PHP process.
 */
class Context {

	/**
	 * Current language code, or null if not yet resolved.
	 *
	 * @var string|null
	 */
	private static $current = null;

	/**
	 * Cached default language code (one query per process).
	 *
	 * @var string|null
	 */
	private static $default = null;

	/**
	 * Active language codes, indexed by code for O(1) lookup.
	 *
	 * @var array<string,array>|null
	 */
	private static $active_by_code = null;

	public static function set( $code ) {
		self::$current = $code ?: null;
	}

	/**
	 * Returns the current language code, falling back to the default.
	 */
	public static function current() {
		if ( null === self::$current ) {
			self::$current = self::default_code();
		}
		return self::$current;
	}

	public static function is_default() {
		return self::current() === self::default_code();
	}

	public static function should_translate() {
		return ! self::is_default();
	}

	public static function default_code() {
		if ( null === self::$default ) {
			$registry      = new LanguageRegistry();
			$default       = $registry->get_default();
			self::$default = $default ? $default['code'] : 'en';
		}
		return self::$default;
	}

	/**
	 * Map of active languages keyed by code.
	 *
	 * @return array<string,array>
	 */
	public static function active_languages() {
		if ( null === self::$active_by_code ) {
			$registry             = new LanguageRegistry();
			$rows                 = $registry->all( true );
			self::$active_by_code = [];
			foreach ( $rows as $row ) {
				self::$active_by_code[ $row['code'] ] = $row;
			}
		}
		return self::$active_by_code;
	}

	public static function is_active( $code ) {
		return isset( self::active_languages()[ $code ] );
	}

	/**
	 * Forget any cached state. Call after language CRUD writes.
	 */
	public static function flush() {
		self::$current        = null;
		self::$default        = null;
		self::$active_by_code = null;
	}
}

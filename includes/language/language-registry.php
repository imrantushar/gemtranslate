<?php
namespace Zentranslate\Language;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\Context;

/**
 * CRUD for the languages table, with object-cache wrapping.
 */
class LanguageRegistry {

	const CACHE_GROUP = 'ztrans_languages';
	const CACHE_KEY_ALL = 'all';
	const CACHE_KEY_DEFAULT = 'default';

	public function table() {
		return Helper::table( 'languages' );
	}

	/**
	 * Return all languages, sorted by position then code.
	 *
	 * @param bool $only_active Filter to active=1 rows.
	 * @return array
	 */
	public function all( $only_active = false ) {
		$cached = wp_cache_get( self::CACHE_KEY_ALL, self::CACHE_GROUP );
		if ( false === $cached ) {
			global $wpdb;
			$cached = $wpdb->get_results(
				"SELECT * FROM {$this->table()} ORDER BY position ASC, code ASC",
				ARRAY_A
			) ?: [];
			wp_cache_set( self::CACHE_KEY_ALL, $cached, self::CACHE_GROUP );
		}

		if ( $only_active ) {
			return array_values( array_filter( $cached, fn( $row ) => (int) $row['active'] === 1 ) );
		}
		return $cached;
	}

	public function get( $code ) {
		foreach ( $this->all() as $row ) {
			if ( $row['code'] === $code ) {
				return $row;
			}
		}
		return null;
	}

	public function get_default() {
		$cached = wp_cache_get( self::CACHE_KEY_DEFAULT, self::CACHE_GROUP );
		if ( false === $cached ) {
			global $wpdb;
			$cached = $wpdb->get_row(
				"SELECT * FROM {$this->table()} WHERE is_default = 1 LIMIT 1",
				ARRAY_A
			);
			wp_cache_set( self::CACHE_KEY_DEFAULT, $cached, self::CACHE_GROUP );
		}
		return $cached ?: null;
	}

	public function count() {
		global $wpdb;
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$this->table()}" );
	}

	public function insert( array $data ) {
		global $wpdb;
		$data = $this->normalize( $data );
		$data['created_at'] = Helper::get_time();
		$result = $wpdb->insert( $this->table(), $data );
		$this->flush_cache();
		if ( $result ) {
			do_action( 'ztrans_language_changed', 'inserted', $data['code'] );
			return $data['code'];
		}
		return false;
	}

	public function update( $code, array $data ) {
		global $wpdb;
		$data = $this->normalize( $data, false );
		unset( $data['code'] );
		if ( empty( $data ) ) {
			return false;
		}
		$result = $wpdb->update( $this->table(), $data, [ 'code' => $code ] );
		$this->flush_cache();
		if ( $result !== false ) {
			do_action( 'ztrans_language_changed', 'updated', $code );
			return true;
		}
		return false;
	}

	public function delete( $code ) {
		global $wpdb;
		$row = $this->get( $code );
		if ( ! $row || (int) $row['is_default'] === 1 ) {
			return false;
		}
		$result = $wpdb->delete( $this->table(), [ 'code' => $code ] );
		$this->flush_cache();
		if ( $result !== false ) {
			do_action( 'ztrans_language_changed', 'deleted', $code );
			return true;
		}
		return false;
	}

	/**
	 * Set a single language as the default. Unsets any prior default.
	 */
	public function set_default( $code ) {
		global $wpdb;
		$wpdb->update( $this->table(), [ 'is_default' => 0 ], [ 'is_default' => 1 ] );
		$wpdb->update( $this->table(), [ 'is_default' => 1, 'active' => 1 ], [ 'code' => $code ] );
		$this->flush_cache();
		do_action( 'ztrans_language_changed', 'default_set', $code );
	}

	public function flush_cache() {
		wp_cache_delete( self::CACHE_KEY_ALL, self::CACHE_GROUP );
		wp_cache_delete( self::CACHE_KEY_DEFAULT, self::CACHE_GROUP );
		Context::flush();
	}

	private function normalize( array $data, $require_required = true ) {
		$allowed = [ 'code', 'locale', 'name', 'native_name', 'flag', 'is_rtl', 'is_default', 'active', 'position', 'country_codes' ];
		$out = array_intersect_key( $data, array_flip( $allowed ) );

		foreach ( [ 'is_rtl', 'is_default', 'active' ] as $bool_key ) {
			if ( isset( $out[ $bool_key ] ) ) {
				$out[ $bool_key ] = (int) (bool) $out[ $bool_key ];
			}
		}
		if ( isset( $out['position'] ) ) {
			$out['position'] = (int) $out['position'];
		}
		if ( isset( $out['code'] ) ) {
			$out['code'] = strtolower( sanitize_key( $out['code'] ) );
		}
		if ( array_key_exists( 'country_codes', $out ) ) {
			$out['country_codes'] = self::normalize_country_codes( $out['country_codes'] );
		}

		return $out;
	}

	/**
	 * Accepts an array of ISO codes, a JSON string, or a comma-separated string.
	 * Returns a JSON-encoded array of uppercase 2-letter codes, or '' for empty.
	 */
	private static function normalize_country_codes( $value ) {
		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			$value   = is_array( $decoded ) ? $decoded : array_map( 'trim', explode( ',', $value ) );
		}
		if ( ! is_array( $value ) ) {
			return '';
		}
		$clean = [];
		foreach ( $value as $code ) {
			$code = strtoupper( trim( (string) $code ) );
			if ( preg_match( '/^[A-Z]{2}$/', $code ) ) {
				$clean[ $code ] = true;
			}
		}
		if ( empty( $clean ) ) {
			return '';
		}
		return wp_json_encode( array_keys( $clean ) );
	}
}

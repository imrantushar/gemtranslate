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
		return $result ? $data['code'] : false;
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
		return $result !== false;
	}

	public function delete( $code ) {
		global $wpdb;
		$row = $this->get( $code );
		if ( ! $row || (int) $row['is_default'] === 1 ) {
			return false;
		}
		$result = $wpdb->delete( $this->table(), [ 'code' => $code ] );
		$this->flush_cache();
		return $result !== false;
	}

	/**
	 * Set a single language as the default. Unsets any prior default.
	 */
	public function set_default( $code ) {
		global $wpdb;
		$wpdb->update( $this->table(), [ 'is_default' => 0 ], [ 'is_default' => 1 ] );
		$wpdb->update( $this->table(), [ 'is_default' => 1, 'active' => 1 ], [ 'code' => $code ] );
		$this->flush_cache();
	}

	public function flush_cache() {
		wp_cache_delete( self::CACHE_KEY_ALL, self::CACHE_GROUP );
		wp_cache_delete( self::CACHE_KEY_DEFAULT, self::CACHE_GROUP );
		Context::flush();
	}

	private function normalize( array $data, $require_required = true ) {
		$allowed = [ 'code', 'locale', 'name', 'native_name', 'flag', 'is_rtl', 'is_default', 'active', 'position' ];
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

		return $out;
	}
}

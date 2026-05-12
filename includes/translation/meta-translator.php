<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\Context;

/**
 * Translates post meta values per language. Stores translations in the
 * `wp_ztrans_post_meta_translations` table and intercepts reads via the
 * `get_post_metadata` filter.
 *
 * - Internal meta (keys starting with `_ztrans_`, `_edit_`, `_wp_`) is
 *   left alone — translating those would break editor / revisions / core.
 * - ACF fields are picked up automatically: ACF stores their values in
 *   post meta, so the standard meta filter covers them.
 */
class MetaTranslator {

	const META_GROUP = 'ztrans_post_meta';

	private static $memo = [];

	public static function init() {
		$self = new self();
		add_filter( 'get_post_metadata', [ $self, 'filter_get_meta' ], 10, 4 );
	}

	/**
	 * Short-circuit `get_post_meta()` with a translated value when the
	 * current language is non-default and a translation exists.
	 *
	 * Signature: (null|mixed $value, int $object_id, string $meta_key, bool $single)
	 */
	public function filter_get_meta( $value, $object_id, $meta_key, $single ) {
		if ( null !== $value ) {
			return $value;
		}
		if ( Context::is_default() || '' === (string) $meta_key ) {
			return $value;
		}
		if ( self::is_internal_key( $meta_key ) ) {
			return $value;
		}
		$row = self::get_for( (int) $object_id, $meta_key );
		if ( null === $row ) {
			return $value;
		}
		$decoded = self::maybe_unserialize( $row['meta_value'] );
		return $single ? $decoded : [ $decoded ];
	}

	private static function get_for( $post_id, $meta_key ) {
		$lang = Context::current();
		$key  = $post_id . ':' . $lang . ':' . $meta_key;
		if ( array_key_exists( $key, self::$memo ) ) {
			return self::$memo[ $key ] ?: null;
		}
		global $wpdb;
		$table = Helper::table( 'post_meta_translations' );
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT meta_value FROM $table WHERE post_id = %d AND language_code = %s AND meta_key = %s",
				$post_id,
				$lang,
				$meta_key
			),
			ARRAY_A
		);
		self::$memo[ $key ] = $row ?: false;
		return $row ?: null;
	}

	public static function all_for_post( $post_id, $language_code ) {
		global $wpdb;
		$table = Helper::table( 'post_meta_translations' );
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT meta_key, meta_value FROM $table WHERE post_id = %d AND language_code = %s",
				(int) $post_id,
				strtolower( $language_code )
			),
			ARRAY_A
		) ?: [];
	}

	public static function save( $post_id, $language_code, $meta_key, $meta_value ) {
		global $wpdb;
		$lang = strtolower( $language_code );
		if ( self::is_internal_key( $meta_key ) ) {
			return false;
		}
		$value = is_array( $meta_value ) || is_object( $meta_value ) ? maybe_serialize( $meta_value ) : (string) $meta_value;
		$table = Helper::table( 'post_meta_translations' );
		$exists = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE post_id = %d AND language_code = %s AND meta_key = %s",
				$post_id,
				$lang,
				$meta_key
			)
		);
		$data = [
			'post_id'       => (int) $post_id,
			'language_code' => $lang,
			'meta_key'      => $meta_key,
			'meta_value'    => $value,
			'updated_at'    => Helper::get_time(),
		];
		$ok = $exists
			? $wpdb->update( $table, $data, [ 'post_id' => $post_id, 'language_code' => $lang, 'meta_key' => $meta_key ] )
			: $wpdb->insert( $table, $data );
		unset( self::$memo[ $post_id . ':' . $lang . ':' . $meta_key ] );
		return $ok !== false;
	}

	public static function delete( $post_id, $language_code, $meta_key ) {
		global $wpdb;
		$lang = strtolower( $language_code );
		$ok   = $wpdb->delete(
			Helper::table( 'post_meta_translations' ),
			[ 'post_id' => (int) $post_id, 'language_code' => $lang, 'meta_key' => $meta_key ]
		);
		unset( self::$memo[ $post_id . ':' . $lang . ':' . $meta_key ] );
		return $ok !== false;
	}

	public static function is_internal_key( $key ) {
		$key = (string) $key;
		if ( '' === $key ) {
			return true;
		}
		if ( 0 === strpos( $key, '_ztrans_' ) ) {
			return true;
		}
		// WP core internal-ish prefixes we should not touch.
		$prefixes = [ '_edit_', '_wp_', '_thumbnail_', '_oembed_' ];
		foreach ( $prefixes as $p ) {
			if ( 0 === strpos( $key, $p ) ) {
				return true;
			}
		}
		// Underscore-prefixed (hidden) custom fields — ACF stores its
		// "field key" mapping there. Skip those automatically.
		return '_' === $key[0];
	}

	private static function maybe_unserialize( $value ) {
		// `maybe_unserialize` is safe; PHP's `unserialize` is not for tainted
		// data, but our writes only happen via our own code path.
		return maybe_unserialize( $value );
	}

	/**
	 * Enumerate translatable meta keys for a post by looking at what's
	 * currently set (skipping internal keys). When ACF is active it adds
	 * "field labels" for nicer UX.
	 *
	 * @return array<array{key:string,label:string,type:string,value:string}>
	 */
	public static function enumerate_fields( $post_id ) {
		$post_id = (int) $post_id;
		$all     = get_post_meta( $post_id );
		$rows    = [];
		$acf     = function_exists( 'get_field_objects' ) ? get_field_objects( $post_id, false ) : null;
		$acf_map = [];
		if ( is_array( $acf ) ) {
			foreach ( $acf as $name => $obj ) {
				$acf_map[ $name ] = [
					'label' => $obj['label'] ?? $name,
					'type'  => $obj['type'] ?? 'text',
				];
			}
		}

		foreach ( $all as $key => $values ) {
			if ( self::is_internal_key( $key ) ) {
				continue;
			}
			$value = isset( $values[0] ) ? maybe_unserialize( $values[0] ) : '';
			$rows[] = [
				'key'   => $key,
				'label' => $acf_map[ $key ]['label'] ?? $key,
				'type'  => $acf_map[ $key ]['type'] ?? ( is_array( $value ) ? 'array' : 'text' ),
				'value' => is_array( $value ) || is_object( $value ) ? wp_json_encode( $value ) : (string) $value,
			];
		}
		return $rows;
	}
}

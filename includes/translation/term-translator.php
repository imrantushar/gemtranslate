<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;

/**
 * Translates taxonomy term names, descriptions, and slugs for the current
 * language. Uses one query per term-lookup, memoized per request.
 */
class TermTranslator {

	private static $memo = [];

	public static function init() {
		$self = new self();
		add_filter( 'get_term', [ $self, 'filter_term' ], 10, 2 );
		add_filter( 'get_terms', [ $self, 'filter_terms' ], 10, 4 );
		add_filter( 'single_term_title', [ $self, 'filter_single_term_title' ] );
	}

	public function filter_term( $term, $taxonomy = null ) {
		if ( Context::is_default() ) {
			return $term;
		}
		if ( ! $term || ! is_object( $term ) ) {
			return $term;
		}
		$row = self::get_for_term( (int) $term->term_id );
		if ( $row ) {
			$this->apply( $term, $row );
		}
		return $term;
	}

	public function filter_terms( $terms, $taxonomies = null, $args = null, $term_query = null ) {
		if ( Context::is_default() || empty( $terms ) || ! is_array( $terms ) ) {
			return $terms;
		}
		foreach ( $terms as $term ) {
			if ( ! is_object( $term ) || empty( $term->term_id ) ) {
				continue;
			}
			$row = self::get_for_term( (int) $term->term_id );
			if ( $row ) {
				$this->apply( $term, $row );
			}
		}
		return $terms;
	}

	public function filter_single_term_title( $name ) {
		if ( Context::is_default() ) {
			return $name;
		}
		$term = get_queried_object();
		if ( ! $term || empty( $term->term_id ) ) {
			return $name;
		}
		$row = self::get_for_term( (int) $term->term_id );
		return $row && '' !== (string) $row['name'] ? $row['name'] : $name;
	}

	private function apply( $term, $row ) {
		if ( '' !== (string) $row['name'] ) {
			$term->name = $row['name'];
		}
		if ( '' !== (string) $row['description'] ) {
			$term->description = $row['description'];
		}
		if ( '' !== (string) $row['slug'] ) {
			$term->slug = $row['slug'];
		}
	}

	public static function get_for_term( $term_id ) {
		if ( Context::is_default() ) {
			return null;
		}
		$term_id = (int) $term_id;
		if ( $term_id <= 0 ) {
			return null;
		}
		$lang = Context::current();
		$key  = $term_id . ':' . $lang;
		if ( array_key_exists( $key, self::$memo ) ) {
			return self::$memo[ $key ] ?: null;
		}
		$row = TranslationCache::get( TranslationCache::GROUP_TERMS, $key );
		if ( false === $row ) {
			global $wpdb;
			$table = Helper::table( 'term_translations' );
			$row   = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM $table WHERE term_id = %d AND language_code = %s LIMIT 1",
					$term_id,
					$lang
				),
				ARRAY_A
			);
			$row = $row ?: null;
			TranslationCache::set( TranslationCache::GROUP_TERMS, $key, $row );
		}
		self::$memo[ $key ] = $row ?: false;
		return $row;
	}

	public static function all_for_term( $term_id ) {
		global $wpdb;
		$table = Helper::table( 'term_translations' );
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM $table WHERE term_id = %d", (int) $term_id ),
			ARRAY_A
		) ?: [];
	}

	public static function save( $term_id, $language_code, array $fields ) {
		$term_id = (int) $term_id;
		$lang    = strtolower( $language_code );
		$term    = get_term( $term_id );
		if ( ! $term || is_wp_error( $term ) ) {
			return false;
		}

		global $wpdb;
		$table = Helper::table( 'term_translations' );

		$group_id = (int) get_term_meta( $term_id, '_gtrans_group_id', true );
		if ( ! $group_id ) {
			// group_id == source term_id. Term IDs are globally unique within a
			// site, so no dedicated groups table is needed — the row scope stays
			// in term_translations.
			$group_id = $term_id;
			update_term_meta( $term_id, '_gtrans_group_id', $group_id );
		}

		$data = [
			'group_id'      => $group_id,
			'language_code' => $lang,
			'term_id'       => $term_id,
			'taxonomy'      => $term->taxonomy,
			'name'          => (string) ( $fields['name'] ?? '' ),
			'description'   => (string) ( $fields['description'] ?? '' ),
			'slug'          => sanitize_title( $fields['slug'] ?? '' ),
			'updated_at'    => Helper::get_time(),
		];

		$exists = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE group_id = %d AND language_code = %s",
				$group_id,
				$lang
			)
		);
		$ok = $exists
			? $wpdb->update( $table, $data, [ 'group_id' => $group_id, 'language_code' => $lang ] )
			: $wpdb->insert( $table, $data );

		TranslationCache::delete( TranslationCache::GROUP_TERMS, $term_id . ':' . $lang );
		unset( self::$memo[ $term_id . ':' . $lang ] );
		return $ok !== false;
	}

	public static function delete( $term_id, $language_code ) {
		global $wpdb;
		$lang = strtolower( $language_code );
		$ok   = $wpdb->delete(
			Helper::table( 'term_translations' ),
			[ 'term_id' => (int) $term_id, 'language_code' => $lang ]
		);
		TranslationCache::delete( TranslationCache::GROUP_TERMS, $term_id . ':' . $lang );
		unset( self::$memo[ $term_id . ':' . $lang ] );
		return $ok !== false;
	}
}

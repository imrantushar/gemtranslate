<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;

/**
 * Translates WP nav menu item titles and optional URL overrides for the
 * current language.
 */
class MenuTranslator {

	public static function init() {
		$self = new self();
		add_filter( 'wp_nav_menu_objects', [ $self, 'filter_menu' ], 10, 2 );
	}

	public function filter_menu( $items, $args = null ) {
		if ( Context::is_default() || empty( $items ) ) {
			return $items;
		}
		$lang = Context::current();
		$ids  = wp_list_pluck( $items, 'ID' );
		if ( empty( $ids ) ) {
			return $items;
		}

		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$table        = Helper::table( 'menu_translations' );

		// One query for the whole menu.
		$query = $wpdb->prepare(
			"SELECT menu_item_id, title, url_override
			 FROM $table
			 WHERE language_code = %s AND menu_item_id IN ($placeholders)",
			array_merge( [ $lang ], array_map( 'intval', $ids ) )
		);
		$rows  = $wpdb->get_results( $query, ARRAY_A ) ?: [];
		$by_id = [];
		foreach ( $rows as $row ) {
			$by_id[ (int) $row['menu_item_id'] ] = $row;
		}

		foreach ( $items as $item ) {
			if ( isset( $by_id[ (int) $item->ID ] ) ) {
				$tr = $by_id[ (int) $item->ID ];
				if ( '' !== (string) $tr['title'] ) {
					$item->title = $tr['title'];
				}
				if ( '' !== (string) $tr['url_override'] ) {
					$item->url = $tr['url_override'];
				}
			}
		}
		return $items;
	}

	public static function save( $menu_item_id, $language_code, array $fields ) {
		global $wpdb;
		$lang = strtolower( $language_code );
		$data = [
			'menu_item_id' => (int) $menu_item_id,
			'language_code' => $lang,
			'title'         => (string) ( $fields['title'] ?? '' ),
			'url_override'  => (string) ( $fields['url_override'] ?? '' ),
			'updated_at'    => Helper::get_time(),
		];

		$table  = Helper::table( 'menu_translations' );
		$exists = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE menu_item_id = %d AND language_code = %s",
				$menu_item_id,
				$lang
			)
		);
		$ok = $exists
			? $wpdb->update( $table, $data, [ 'menu_item_id' => $menu_item_id, 'language_code' => $lang ] )
			: $wpdb->insert( $table, $data );
		return $ok !== false;
	}

	public static function all_for_item( $menu_item_id ) {
		global $wpdb;
		$table = Helper::table( 'menu_translations' );
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM $table WHERE menu_item_id = %d", (int) $menu_item_id ),
			ARRAY_A
		) ?: [];
	}
}

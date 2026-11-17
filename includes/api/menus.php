<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Translation\MenuTranslator;

class Menus extends Controller {

	protected $rest_base = 'menus';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/items',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'items' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'page'     => [ 'type' => 'integer', 'default' => 1 ],
					'per_page' => [ 'type' => 'integer', 'default' => 50 ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/items/(?P<item_id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save_item' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);
	}

	public function index( $request ) {
		$menus = wp_get_nav_menus();
		$rows  = [];
		foreach ( $menus as $menu ) {
			$rows[] = [
				'id'    => (int) $menu->term_id,
				'name'  => $menu->name,
				'slug'  => $menu->slug,
				'count' => (int) $menu->count,
			];
		}
		return $this->ok( $rows, [ 'count' => count( $rows ) ] );
	}

	public function items( $request ) {
		$menu_id = (int) $request['id'];
		$items   = wp_get_nav_menu_items( $menu_id );
		if ( false === $items ) {
			return $this->fail( 'gtrans_not_found', __( 'Menu not found.', 'gemtranslate' ), 404 );
		}

		$default     = Context::default_code();
		$rows        = [];
		$per_page    = max( 1, min( 200, (int) $request->get_param( 'per_page' ) ) );
		$total       = count( $items );
		$total_pages = max( 1, (int) ceil( $total / $per_page ) );
		$page        = min( max( 1, (int) $request->get_param( 'page' ) ), $total_pages );
		$items       = array_slice( $items, ( $page - 1 ) * $per_page, $per_page );
		foreach ( $items as $item ) {
			$translations = MenuTranslator::all_for_item( $item->ID );
			$by_lang      = [];
			foreach ( $translations as $row ) {
				$by_lang[ $row['language_code'] ] = $row;
			}
			$rows[] = [
				'id'           => (int) $item->ID,
				'title'        => $item->title,
				'url'          => $item->url,
				'parent'       => (int) $item->menu_item_parent,
				'translations' => $by_lang,
			];
		}
		return $this->ok(
			$rows,
			[
				'default_lang' => $default,
				'total'        => $total,
				'total_pages'  => $total_pages,
				'page'         => $page,
				'per_page'     => $per_page,
			]
		);
	}

	public function save_item( $request ) {
		$item_id = (int) $request['item_id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$body = $request->get_json_params() ?: $request->get_params();
		$ok   = MenuTranslator::save( $item_id, $lang, $body );
		if ( ! $ok ) {
			return $this->fail( 'gtrans_save_failed', __( 'Could not save translation.', 'gemtranslate' ), 500 );
		}
		return $this->ok( [ 'saved' => true, 'menu_item_id' => $item_id, 'language_code' => $lang ] );
	}
}

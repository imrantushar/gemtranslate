<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Translation\MenuTranslator;

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
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/items',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'items' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/items/(?P<item_id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
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
			return $this->fail( 'ztrans_not_found', __( 'Menu not found.', 'zentranslate' ), 404 );
		}

		$default = Context::default_code();
		$rows    = [];
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
		return $this->ok( $rows, [ 'default_lang' => $default ] );
	}

	public function save_item( $request ) {
		$item_id = (int) $request['item_id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$body = $request->get_json_params() ?: $request->get_params();
		$ok   = MenuTranslator::save( $item_id, $lang, $body );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not save translation.', 'zentranslate' ), 500 );
		}
		return $this->ok( [ 'saved' => true, 'menu_item_id' => $item_id, 'language_code' => $lang ] );
	}
}

<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\Context;
use Zentranslate\Translation\TranslationLoader;

class SEO extends Controller {

	protected $rest_base = 'seo';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/posts/(?P<post_id>\d+)/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);
	}

	public function show( $request ) {
		$post_id = (int) $request['post_id'];
		$lang    = strtolower( $request['lang'] );
		$group   = TranslationLoader::group_id_for_post( $post_id );
		if ( ! $group ) {
			return $this->ok( $this->empty_row( $lang ) );
		}
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM " . Helper::table( 'seo_meta' ) . " WHERE group_id = %d AND language_code = %s LIMIT 1",
				$group,
				$lang
			),
			ARRAY_A
		);
		return $this->ok( $row ?: $this->empty_row( $lang ) );
	}

	public function save( $request ) {
		$post_id = (int) $request['post_id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}

		$group = TranslationLoader::ensure_group_for_post( $post_id );
		if ( ! $group ) {
			return $this->fail( 'ztrans_no_group', __( 'Could not establish translation group.', 'zentranslate' ), 500 );
		}

		$body = $request->get_json_params() ?: $request->get_params();
		$data = [
			'group_id'           => $group,
			'language_code'      => $lang,
			'meta_title'         => (string) ( $body['meta_title'] ?? '' ),
			'meta_desc'          => (string) ( $body['meta_desc'] ?? '' ),
			'og_title'           => (string) ( $body['og_title'] ?? '' ),
			'og_desc'            => (string) ( $body['og_desc'] ?? '' ),
			'canonical_override' => (string) ( $body['canonical_override'] ?? '' ),
			'updated_at'         => Helper::get_time(),
		];

		global $wpdb;
		$table  = Helper::table( 'seo_meta' );
		$exists = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE group_id = %d AND language_code = %s",
				$group,
				$lang
			)
		);
		$ok = $exists
			? $wpdb->update( $table, $data, [ 'group_id' => $group, 'language_code' => $lang ] )
			: $wpdb->insert( $table, $data );
		if ( $ok === false ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not save SEO meta.', 'zentranslate' ), 500 );
		}
		return $this->ok( $data );
	}

	private function empty_row( $lang ) {
		return [
			'group_id'           => 0,
			'language_code'      => $lang,
			'meta_title'         => '',
			'meta_desc'          => '',
			'og_title'           => '',
			'og_desc'            => '',
			'canonical_override' => '',
		];
	}
}

<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Translation\TranslationLoader;

class PostTranslations extends Controller {

	protected $rest_base = 'posts';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/post-types',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'list_post_types' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		// List posts with translation status per language.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'page'      => [ 'type' => 'integer', 'default' => 1 ],
					'per_page'  => [ 'type' => 'integer', 'default' => 20 ],
					'search'    => [ 'type' => 'string' ],
					'post_type' => [ 'type' => 'string', 'default' => 'post' ],
					'status'    => [ 'type' => 'string', 'default' => 'any' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_translations' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show_translation' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_translation' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_translation' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
				],
			]
		);
	}

	/**
	 * Public post types the user can edit. Used to populate the filter
	 * dropdown in the React Posts page.
	 */
	public function list_post_types() {
		$out = [];
		$post_types = get_post_types( [ 'public' => true ], 'objects' );
		foreach ( $post_types as $type ) {
			if ( 'attachment' === $type->name ) {
				continue;
			}
			if ( ! current_user_can( $type->cap->edit_posts ?? 'edit_posts' ) ) {
				continue;
			}
			$out[] = [
				'name'  => $type->name,
				'label' => $type->labels->name ?? $type->label,
			];
		}
		return $this->ok( $out );
	}

	public function index( $request ) {
		$args = [
			'post_type'      => $request->get_param( 'post_type' ) ?: 'post',
			'post_status'    => $request->get_param( 'status' ) ?: 'any',
			'posts_per_page' => max( 1, min( 100, (int) $request->get_param( 'per_page' ) ) ),
			'paged'          => max( 1, (int) $request->get_param( 'page' ) ),
			's'              => (string) $request->get_param( 'search' ),
			'orderby'        => 'date',
			'order'          => 'DESC',
		];

		$query = new \WP_Query( $args );
		$rows  = [];
		foreach ( $query->posts as $post ) {
			$rows[] = $this->prepare_post_row( $post );
		}

		return $this->ok(
			$rows,
			[
				'total'       => (int) $query->found_posts,
				'total_pages' => (int) $query->max_num_pages,
				'page'        => $args['paged'],
				'per_page'    => $args['posts_per_page'],
			]
		);
	}

	public function get_translations( $request ) {
		$post_id = (int) $request['id'];
		$post    = get_post( $post_id );
		if ( ! $post ) {
			return $this->fail( 'ztrans_not_found', __( 'Post not found.', 'zentranslate' ), 404 );
		}

		$existing  = [];
		foreach ( TranslationLoader::all_for_post( $post_id ) as $row ) {
			$existing[ $row['language_code'] ] = $this->prepare_translation_row( $row );
		}

		$languages = Context::active_languages();
		$default   = Context::default_code();
		$result    = [
			'post'         => $this->prepare_post_row( $post, true ),
			'default_lang' => $default,
			'translations' => [],
		];

		foreach ( $languages as $code => $lang ) {
			if ( $code === $default ) {
				continue;
			}
			$result['translations'][] = [
				'language'    => $lang,
				'translation' => $existing[ $code ] ?? null,
			];
		}

		return $this->ok( $result );
	}

	public function show_translation( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$rows    = TranslationLoader::all_for_post( $post_id );
		foreach ( $rows as $row ) {
			if ( $row['language_code'] === $lang ) {
				return $this->ok( $this->prepare_translation_row( $row ) );
			}
		}
		return $this->fail( 'ztrans_not_found', __( 'Translation not found.', 'zentranslate' ), 404 );
	}

	public function save_translation( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		if ( ! get_post( $post_id ) ) {
			return $this->fail( 'ztrans_not_found', __( 'Post not found.', 'zentranslate' ), 404 );
		}

		$body = $request->get_json_params() ?: $request->get_params();
		$ok   = TranslationLoader::save_translation( $post_id, $lang, [
			'title'   => $body['title']   ?? '',
			'content' => $body['content'] ?? '',
			'excerpt' => $body['excerpt'] ?? '',
			'slug'    => $body['slug']    ?? '',
			'status'  => $body['status']  ?? 'publish',
		] );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not save translation.', 'zentranslate' ), 500 );
		}
		return $this->show_translation( $request );
	}

	public function delete_translation( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		TranslationLoader::delete_translation( $post_id, $lang );
		return $this->ok( [ 'deleted' => true, 'post_id' => $post_id, 'language_code' => $lang ] );
	}

	private function prepare_post_row( $post, $full = false ) {
		$out = [
			'id'                  => (int) $post->ID,
			'title'               => get_the_title( $post ),
			'slug'                => $post->post_name,
			'status'              => $post->post_status,
			'type'                => $post->post_type,
			'modified'            => $post->post_modified_gmt,
			'translations_status' => TranslationLoader::status_map( $post->ID ),
		];

		if ( $full ) {
			$out['content'] = (string) $post->post_content;
			$out['excerpt'] = (string) $post->post_excerpt;
		}
		return $out;
	}

	private function prepare_translation_row( $row ) {
		return [
			'group_id'      => (int) $row['group_id'],
			'language_code' => $row['language_code'],
			'post_id'       => (int) $row['post_id'],
			'title'         => $row['title'],
			'content'       => $row['content'],
			'excerpt'       => $row['excerpt'],
			'slug'          => $row['slug'],
			'status'        => $row['status'],
			'updated_at'    => $row['updated_at'],
		];
	}
}

<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Translation\TermTranslator;

class TermTranslations extends Controller {

	protected $rest_base = 'terms';

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
				'args'                => [
					'taxonomy' => [ 'type' => 'string', 'default' => 'category' ],
					'page'     => [ 'type' => 'integer', 'default' => 1 ],
					'per_page' => [ 'type' => 'integer', 'default' => 50 ],
					'search'   => [ 'type' => 'string' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_translations' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);
	}

	public function index( $request ) {
		$taxonomy = $request->get_param( 'taxonomy' ) ?: 'category';
		$args     = [
			'taxonomy'   => $taxonomy,
			'number'     => max( 1, min( 200, (int) $request->get_param( 'per_page' ) ) ),
			'offset'     => ( max( 1, (int) $request->get_param( 'page' ) ) - 1 ) * (int) $request->get_param( 'per_page' ),
			'hide_empty' => false,
			'search'     => (string) $request->get_param( 'search' ),
		];
		$terms = get_terms( $args );
		if ( is_wp_error( $terms ) ) {
			return $this->fail( 'ztrans_bad_taxonomy', $terms->get_error_message(), 400 );
		}

		$rows = [];
		foreach ( $terms as $term ) {
			$translations = TermTranslator::all_for_term( $term->term_id );
			$status_by_lang = [];
			foreach ( $translations as $t ) {
				$status_by_lang[ $t['language_code'] ] = 'translated';
			}
			$rows[] = [
				'id'                  => (int) $term->term_id,
				'name'                => $term->name,
				'slug'                => $term->slug,
				'taxonomy'            => $term->taxonomy,
				'count'               => (int) $term->count,
				'translations_status' => $status_by_lang,
			];
		}
		return $this->ok( $rows, [ 'count' => count( $rows ) ] );
	}

	public function get_translations( $request ) {
		$term_id = (int) $request['id'];
		$term    = get_term( $term_id );
		if ( ! $term || is_wp_error( $term ) ) {
			return $this->fail( 'ztrans_not_found', __( 'Term not found.', 'zentranslate' ), 404 );
		}

		$existing = [];
		foreach ( TermTranslator::all_for_term( $term_id ) as $row ) {
			$existing[ $row['language_code'] ] = $row;
		}

		$default = Context::default_code();
		$out     = [
			'term'         => [
				'id'          => (int) $term->term_id,
				'name'        => $term->name,
				'slug'        => $term->slug,
				'description' => $term->description,
				'taxonomy'    => $term->taxonomy,
			],
			'default_lang' => $default,
			'translations' => [],
		];
		foreach ( Context::active_languages() as $code => $lang ) {
			if ( $code === $default ) {
				continue;
			}
			$out['translations'][] = [
				'language'    => $lang,
				'translation' => $existing[ $code ] ?? null,
			];
		}
		return $this->ok( $out );
	}

	public function save( $request ) {
		$term_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$body = $request->get_json_params() ?: $request->get_params();
		$ok   = TermTranslator::save( $term_id, $lang, $body );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not save translation.', 'zentranslate' ), 500 );
		}
		return $this->get_translations( $request );
	}

	public function delete( $request ) {
		$term_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		TermTranslator::delete( $term_id, $lang );
		return $this->ok( [ 'deleted' => true, 'term_id' => $term_id, 'language_code' => $lang ] );
	}
}

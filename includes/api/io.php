<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Io\Csv;
use Zentranslate\Io\Xliff;
use Zentranslate\Language\Context;
use Zentranslate\Translation\StringTranslator;
use Zentranslate\Translation\TranslationLoader;

class Io extends Controller {

	protected $rest_base = 'io';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/export/strings',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'export_strings' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'format' => [ 'type' => 'string', 'default' => 'xliff' ],
					'lang'   => [ 'type' => 'string', 'required' => true ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/export/posts',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'export_posts' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'format'    => [ 'type' => 'string', 'default' => 'xliff' ],
					'lang'      => [ 'type' => 'string', 'required' => true ],
					'post_type' => [ 'type' => 'string', 'default' => 'post' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/import/strings',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import_strings' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'lang'   => [ 'type' => 'string', 'required' => true ],
					'format' => [ 'type' => 'string', 'default' => 'xliff' ],
					'body'   => [ 'type' => 'string', 'required' => true ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/import/posts',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import_posts' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'lang'   => [ 'type' => 'string', 'required' => true ],
					'format' => [ 'type' => 'string', 'default' => 'xliff' ],
					'body'   => [ 'type' => 'string', 'required' => true ],
				],
			]
		);
	}

	public function export_strings( $request ) {
		$lang   = strtolower( (string) $request->get_param( 'lang' ) );
		$format = (string) $request->get_param( 'format' );
		$source = Context::default_code();

		global $wpdb;
		$st   = Helper::table( 'strings' );
		$stt  = Helper::table( 'string_translations' );
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.string_id, s.source, t.value AS target
				 FROM $st AS s
				 LEFT JOIN $stt AS t ON t.string_id = s.string_id AND t.language_code = %s",
				$lang
			),
			ARRAY_A
		) ?: [];

		$units = [];
		foreach ( $rows as $r ) {
			$units[] = [
				'id'     => 'string:' . $r['string_id'],
				'source' => (string) $r['source'],
				'target' => (string) ( $r['target'] ?? '' ),
			];
		}

		return $this->respond_file( $units, $source, $lang, $format, 'zentranslate-strings' );
	}

	public function export_posts( $request ) {
		$lang      = strtolower( (string) $request->get_param( 'lang' ) );
		$format    = (string) $request->get_param( 'format' );
		$post_type = (string) $request->get_param( 'post_type' );
		$source    = Context::default_code();

		$query = new \WP_Query( [
			'post_type'      => $post_type ?: 'post',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'fields'         => 'ids',
		] );
		$units = [];
		foreach ( $query->posts as $id ) {
			$post = get_post( $id );
			if ( ! $post ) {
				continue;
			}
			$existing = [];
			foreach ( TranslationLoader::all_for_post( $id ) as $row ) {
				if ( $row['language_code'] === $lang ) {
					$existing = $row;
					break;
				}
			}
			foreach ( [ 'title', 'content', 'excerpt' ] as $field ) {
				$source_value = $post->{ 'post_' . $field };
				if ( '' === (string) $source_value ) {
					continue;
				}
				$units[] = [
					'id'     => "post:{$id}:{$field}",
					'source' => (string) $source_value,
					'target' => (string) ( $existing[ $field ] ?? '' ),
					'note'   => $post->post_title,
				];
			}
		}

		return $this->respond_file( $units, $source, $lang, $format, 'zentranslate-' . $post_type );
	}

	public function import_strings( $request ) {
		$lang   = strtolower( (string) $request->get_param( 'lang' ) );
		$format = (string) $request->get_param( 'format' );
		$body   = (string) $request->get_param( 'body' );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$units = 'csv' === $format ? Csv::parse( $body ) : Xliff::parse( $body );
		$saved = 0;
		foreach ( $units as $u ) {
			if ( 0 !== strpos( (string) $u['id'], 'string:' ) ) {
				continue;
			}
			$id     = (int) substr( $u['id'], strlen( 'string:' ) );
			$target = (string) ( $u['target'] ?? '' );
			if ( ! $id || '' === $target ) {
				continue;
			}
			if ( StringTranslator::save_translation( $id, $lang, $target ) ) {
				$saved++;
			}
		}
		return $this->ok( [ 'saved' => $saved, 'units' => count( $units ) ] );
	}

	public function import_posts( $request ) {
		$lang   = strtolower( (string) $request->get_param( 'lang' ) );
		$format = (string) $request->get_param( 'format' );
		$body   = (string) $request->get_param( 'body' );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$units = 'csv' === $format ? Csv::parse( $body ) : Xliff::parse( $body );

		// Group units by post id so we save one row per post.
		$by_post = [];
		foreach ( $units as $u ) {
			if ( 0 !== strpos( (string) $u['id'], 'post:' ) ) {
				continue;
			}
			$parts = explode( ':', (string) $u['id'] );
			if ( count( $parts ) < 3 ) {
				continue;
			}
			$post_id = (int) $parts[1];
			$field   = $parts[2];
			if ( ! in_array( $field, [ 'title', 'content', 'excerpt' ], true ) ) {
				continue;
			}
			$by_post[ $post_id ][ $field ] = (string) ( $u['target'] ?? '' );
		}

		$saved = 0;
		foreach ( $by_post as $post_id => $fields ) {
			$post = get_post( $post_id );
			if ( ! $post ) {
				continue;
			}
			$ok = TranslationLoader::save_translation(
				$post_id,
				$lang,
				[
					'title'   => $fields['title']   ?? $post->post_title,
					'content' => $fields['content'] ?? $post->post_content,
					'excerpt' => $fields['excerpt'] ?? $post->post_excerpt,
					'slug'    => $post->post_name,
					'status'  => 'publish',
				]
			);
			if ( $ok ) {
				$saved++;
			}
		}
		return $this->ok( [ 'saved' => $saved, 'units' => count( $units ) ] );
	}

	private function respond_file( $units, $source, $target, $format, $basename ) {
		if ( 'csv' === $format ) {
			$body  = Csv::build( $units );
			$mime  = 'text/csv';
			$ext   = 'csv';
		} else {
			$body  = Xliff::build( $units, $source, $target );
			$mime  = 'application/xml';
			$ext   = 'xliff';
		}
		$filename = sprintf( '%s-%s.%s', $basename, $target, $ext );
		$response = new \WP_REST_Response( $body );
		$response->set_headers( [
			'Content-Type'        => $mime . '; charset=utf-8',
			'Content-Disposition' => 'attachment; filename="' . $filename . '"',
		] );
		return $response;
	}
}

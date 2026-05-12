<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Translation\TranslationHistory;
use Zentranslate\Translation\TranslationLoader;
use Zentranslate\Language\Context;

class Revisions extends Controller {

	protected $rest_base = 'posts';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})/revisions',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})/revisions/(?P<revision_id>\d+)',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'show' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})/revisions/(?P<revision_id>\d+)/revert',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'revert' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})/diff',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'diff' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'a' => [ 'type' => 'integer', 'required' => true ],
					'b' => [ 'type' => 'integer', 'required' => true ],
				],
			]
		);
	}

	public function index( $request ) {
		$rows = TranslationHistory::list_for( (int) $request['id'], $request['lang'] );
		return $this->ok( array_map( [ $this, 'prepare_summary' ], $rows ) );
	}

	public function show( $request ) {
		$row = TranslationHistory::get( (int) $request['revision_id'] );
		if ( ! $row ) {
			return $this->fail( 'ztrans_not_found', __( 'Revision not found.', 'zentranslate' ), 404 );
		}
		return $this->ok( $row );
	}

	public function revert( $request ) {
		$post_id     = (int) $request['id'];
		$lang        = strtolower( $request['lang'] );
		$revision_id = (int) $request['revision_id'];
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$row = TranslationHistory::get( $revision_id );
		if ( ! $row ) {
			return $this->fail( 'ztrans_not_found', __( 'Revision not found.', 'zentranslate' ), 404 );
		}

		$ok = TranslationLoader::save_translation(
			$post_id,
			$lang,
			[
				'title'   => $row['title'],
				'content' => $row['content'],
				'excerpt' => $row['excerpt'],
				'slug'    => $row['slug'],
				'status'  => $row['status'],
			]
		);
		if ( ! $ok ) {
			return $this->fail( 'ztrans_revert_failed', __( 'Could not revert translation.', 'zentranslate' ), 500 );
		}
		return $this->ok( [ 'reverted' => true, 'revision_id' => $revision_id ] );
	}

	public function diff( $request ) {
		$result = TranslationHistory::diff( (int) $request['a'], (int) $request['b'] );
		if ( ! $result ) {
			return $this->fail( 'ztrans_not_found', __( 'One or both revisions not found.', 'zentranslate' ), 404 );
		}
		return $this->ok( $result );
	}

	private function prepare_summary( $row ) {
		$author = $row['author_id'] ? get_user_by( 'id', (int) $row['author_id'] ) : null;
		return [
			'revision_id'  => (int) $row['revision_id'],
			'created_at'   => $row['created_at'],
			'status'       => $row['status'],
			'source_hash'  => $row['source_hash'],
			'title_preview' => $row['title_preview'],
			'content_size' => (int) $row['content_size'],
			'note'         => $row['note'],
			'author'       => $author ? [ 'id' => (int) $author->ID, 'name' => $author->display_name ] : null,
		];
	}
}

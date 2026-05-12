<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\AI\JobRunner;
use Zentranslate\Language\Context;

class Jobs extends Controller {

	protected $rest_base = 'jobs';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'index' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
					'args'                => [
						'status'   => [ 'type' => 'string' ],
						'page'     => [ 'type' => 'integer', 'default' => 1 ],
						'per_page' => [ 'type' => 'integer', 'default' => 50 ],
					],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/counts',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'counts' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'destroy' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/retry',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'retry' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		// Bulk-enqueue translation jobs from the React UI.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/bulk-translate',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'bulk_translate' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'post_ids'  => [ 'required' => true ],
					'languages' => [ 'required' => true ],
				],
			]
		);
	}

	public function index( $request ) {
		$result = JobRunner::list_jobs( [
			'status'   => (string) $request->get_param( 'status' ),
			'page'     => (int) $request->get_param( 'page' ),
			'per_page' => (int) $request->get_param( 'per_page' ),
		] );

		$rows = array_map( [ $this, 'prepare_row' ], $result['rows'] );
		return $this->ok( $rows, [
			'total'    => $result['total'],
			'page'     => $result['page'],
			'per_page' => $result['per_page'],
		] );
	}

	public function counts() {
		return $this->ok( JobRunner::counts() );
	}

	public function show( $request ) {
		$row = JobRunner::get_job( (int) $request['id'] );
		if ( ! $row ) {
			return $this->fail( 'ztrans_not_found', __( 'Job not found.', 'zentranslate' ), 404 );
		}
		return $this->ok( $this->prepare_row( $row ) );
	}

	public function create( $request ) {
		// Single ad-hoc job from the editor: { post_id, target_lang, options }
		$body = $request->get_json_params() ?: $request->get_params();
		$post_id = (int) ( $body['post_id'] ?? 0 );
		$lang    = strtolower( (string) ( $body['target_lang'] ?? '' ) );
		if ( $post_id <= 0 || ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid', __( 'post_id and active target_lang are required.', 'zentranslate' ), 422 );
		}
		$id = JobRunner::queue_translate_post( $post_id, $lang, $body['options'] ?? [] );
		return $this->ok( [ 'job_id' => $id ], [], 201 );
	}

	public function bulk_translate( $request ) {
		$body      = $request->get_json_params() ?: $request->get_params();
		$post_ids  = array_filter( array_map( 'intval', (array) ( $body['post_ids'] ?? [] ) ) );
		$languages = array_filter( array_map( 'strtolower', (array) ( $body['languages'] ?? [] ) ) );
		$options   = (array) ( $body['options'] ?? [] );

		if ( empty( $post_ids ) || empty( $languages ) ) {
			return $this->fail( 'ztrans_invalid', __( 'post_ids and languages are required.', 'zentranslate' ), 422 );
		}

		$queued = [];
		foreach ( $languages as $lang ) {
			if ( ! Context::is_active( $lang ) ) {
				continue;
			}
			foreach ( $post_ids as $pid ) {
				$queued[] = JobRunner::queue_translate_post( $pid, $lang, $options );
			}
		}
		return $this->ok( [ 'queued' => count( $queued ), 'job_ids' => $queued ], [], 202 );
	}

	public function retry( $request ) {
		$ok = JobRunner::retry( (int) $request['id'] );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_not_found', __( 'Job not found.', 'zentranslate' ), 404 );
		}
		return $this->ok( [ 'retried' => true ] );
	}

	public function destroy( $request ) {
		JobRunner::delete( (int) $request['id'] );
		return $this->ok( [ 'deleted' => true ] );
	}

	private function prepare_row( $row ) {
		$payload = json_decode( (string) ( $row['payload'] ?? '' ), true ) ?: [];
		return [
			'job_id'       => (int) $row['job_id'],
			'type'         => $row['type'],
			'status'       => $row['status'],
			'attempts'     => (int) $row['attempts'],
			'error'        => $row['error'],
			'scheduled_at' => $row['scheduled_at'],
			'updated_at'   => $row['updated_at'],
			'payload'      => $payload,
		];
	}
}

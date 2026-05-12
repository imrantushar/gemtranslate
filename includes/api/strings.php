<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\StringScanner\FileWalker;
use Zentranslate\Translation\StringTranslator;

class Strings extends Controller {

	protected $rest_base = 'strings';

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
					'page'     => [ 'type' => 'integer', 'default' => 1 ],
					'per_page' => [ 'type' => 'integer', 'default' => 50 ],
					'search'   => [ 'type' => 'string' ],
					'domain'   => [ 'type' => 'string' ],
					'lang'     => [ 'type' => 'string' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/domains',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'domains' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save_translation' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/bulk',
			[
				'methods'             => 'PATCH',
				'callback'            => [ $this, 'bulk_save' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/scan',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'scan' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'target' => [ 'type' => 'string', 'default' => 'active_theme' ],
					'path'   => [ 'type' => 'string' ],
				],
			]
		);
	}

	public function index( $request ) {
		$result = StringTranslator::list_strings( [
			'page'     => (int) $request->get_param( 'page' ),
			'per_page' => (int) $request->get_param( 'per_page' ),
			'search'   => (string) $request->get_param( 'search' ),
			'domain'   => (string) $request->get_param( 'domain' ),
			'lang'     => (string) $request->get_param( 'lang' ),
		] );
		return $this->ok( $result['rows'], [
			'total'    => $result['total'],
			'page'     => $result['page'],
			'per_page' => $result['per_page'],
		] );
	}

	public function domains( $request ) {
		return $this->ok( StringTranslator::list_domains() );
	}

	public function save_translation( $request ) {
		$id   = (int) $request['id'];
		$lang = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$body  = $request->get_json_params() ?: $request->get_params();
		$value = (string) ( $body['value'] ?? '' );
		$status = (string) ( $body['status'] ?? 'translated' );
		$ok    = StringTranslator::save_translation( $id, $lang, $value, $status );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not save translation.', 'zentranslate' ), 500 );
		}
		return $this->ok( [ 'saved' => true, 'string_id' => $id, 'language_code' => $lang ] );
	}

	public function bulk_save( $request ) {
		$body = $request->get_json_params() ?: $request->get_params();
		$rows = $body['translations'] ?? [];
		$saved = 0;
		foreach ( $rows as $row ) {
			$lang = strtolower( (string) ( $row['language_code'] ?? '' ) );
			$id   = (int) ( $row['string_id'] ?? 0 );
			if ( ! $id || ! Context::is_active( $lang ) ) {
				continue;
			}
			if ( StringTranslator::save_translation( $id, $lang, (string) ( $row['value'] ?? '' ), (string) ( $row['status'] ?? 'translated' ) ) ) {
				$saved++;
			}
		}
		return $this->ok( [ 'saved' => $saved ] );
	}

	public function scan( $request ) {
		$target = (string) $request->get_param( 'target' );
		$path   = (string) $request->get_param( 'path' );

		switch ( $target ) {
			case 'active_theme':
				$dir = get_template_directory();
				break;
			case 'all_plugins':
				$dir = WP_PLUGIN_DIR;
				break;
			case 'custom':
				$dir = wp_normalize_path( $path );
				if ( ! $dir || ! is_dir( $dir ) ) {
					return $this->fail( 'ztrans_bad_path', __( 'Directory does not exist.', 'zentranslate' ), 422 );
				}
				break;
			default:
				return $this->fail( 'ztrans_bad_target', __( 'Unknown scan target.', 'zentranslate' ), 422 );
		}

		$result = FileWalker::scan_directory( $dir );
		return $this->ok( array_merge( $result, [ 'target' => $target, 'directory' => $dir ] ) );
	}
}

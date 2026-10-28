<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\I18n\PackGenerator;
use GemTranslate\I18n\WporgImporter;
use GemTranslate\Language\Context;
use GemTranslate\StringScanner\Auditor;
use GemTranslate\StringScanner\FileWalker;
use GemTranslate\Translation\StringTranslator;

class Strings extends Controller {

	protected $rest_base = 'strings';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		// ----- Legacy flat list (kept for the /strings/legacy power-user view) -----
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'page'     => [ 'type' => 'integer', 'default' => 1 ],
					'per_page' => [ 'type' => 'integer', 'default' => 50 ],
					'search'   => [ 'type' => 'string' ],
					'domain'   => [ 'type' => 'string' ],
					'lang'     => [ 'type' => 'string' ],
					'status'   => [ 'type' => 'string' ], // '', 'translated', 'untranslated'
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/domains',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'domains' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save_translation' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/bulk',
			[
				'methods'             => 'PATCH',
				'callback'            => [ $this, 'bulk_save' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/scan',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'scan' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [
					'target' => [ 'type' => 'string', 'default' => 'active_theme' ],
					'path'   => [ 'type' => 'string' ],
				],
			]
		);

		// ----- New per-package endpoints (v1.4) -----
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packages',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'list_packages' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packages/(?P<slug>[A-Za-z0-9_\-]+)/scan',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'scan_package' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packages/(?P<slug>[A-Za-z0-9_\-]+)/audit',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_audit' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'run_audit' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packages/(?P<slug>[A-Za-z0-9_\-]+)/(?P<lang>[a-z0-9\-]{2,10})/export',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'export_package' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);
	}

	// =====================================================================
	// Legacy endpoints
	// =====================================================================

	public function index( $request ) {
		$result = StringTranslator::list_strings( [
			'page'     => (int) $request->get_param( 'page' ),
			'per_page' => (int) $request->get_param( 'per_page' ),
			'search'   => (string) $request->get_param( 'search' ),
			'domain'   => (string) $request->get_param( 'domain' ),
			'lang'     => (string) $request->get_param( 'lang' ),
			'status'   => (string) $request->get_param( 'status' ),
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
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$body   = $request->get_json_params() ?: $request->get_params();
		$value  = (string) ( $body['value'] ?? '' );
		$status = (string) ( $body['status'] ?? 'translated' );
		$ok     = StringTranslator::save_translation( $id, $lang, $value, $status );
		if ( ! $ok ) {
			return $this->fail( 'gtrans_save_failed', __( 'Could not save translation.', 'gemtranslate' ), 500 );
		}
		return $this->ok( [ 'saved' => true, 'string_id' => $id, 'language_code' => $lang ] );
	}

	public function bulk_save( $request ) {
		$body  = $request->get_json_params() ?: $request->get_params();
		$rows  = $body['translations'] ?? [];
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
					return $this->fail( 'gtrans_bad_path', __( 'Directory does not exist.', 'gemtranslate' ), 422 );
				}
				break;
			default:
				return $this->fail( 'gtrans_bad_target', __( 'Unknown scan target.', 'gemtranslate' ), 422 );
		}

		$result = FileWalker::scan_directory( $dir );
		return $this->ok( array_merge( $result, [ 'target' => $target, 'directory' => $dir ] ) );
	}

	// =====================================================================
	// Per-package endpoints
	// =====================================================================

	/**
	 * Enumerate every installed plugin and theme, with per-language progress.
	 * Powers the new Strings landing page.
	 */
	public function list_packages( $request ) {
		$languages = Context::active_languages();
		$default   = Context::default_code();
		$lang_codes = [];
		foreach ( $languages as $code => $row ) {
			if ( $code !== $default ) {
				$lang_codes[] = $code;
			}
		}

		$summaries = get_option( self::AUDIT_SUMMARIES_OPTION, [] );
		$summaries = is_array( $summaries ) ? $summaries : [];

		$packages = [];
		foreach ( $this->collect_plugins() as $pkg ) {
			$pkg['per_lang'] = StringTranslator::translation_progress( $pkg['text_domain'], $lang_codes );
			$pkg['audit']    = $summaries[ $pkg['slug'] ] ?? null;
			$packages[]     = $pkg;
		}
		foreach ( $this->collect_themes() as $pkg ) {
			$pkg['per_lang'] = StringTranslator::translation_progress( $pkg['text_domain'], $lang_codes );
			$pkg['audit']    = $summaries[ $pkg['slug'] ] ?? null;
			$packages[]     = $pkg;
		}

		usort( $packages, function ( $a, $b ) {
			// Group: themes after plugins; alphabetical within each.
			$by_type = strcmp( $a['type'], $b['type'] );
			if ( 0 !== $by_type ) {
				return $by_type;
			}
			return strcasecmp( $a['name'], $b['name'] );
		} );

		return $this->ok( $packages, [ 'languages' => $lang_codes ] );
	}

	private function collect_plugins() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$rows = [];
		foreach ( get_plugins() as $file => $data ) {
			$slug   = dirname( $file );
			if ( '.' === $slug ) {
				$slug = basename( $file, '.php' );
			}
			$domain = (string) ( $data['TextDomain'] ?: $slug );
			$rows[] = [
				'type'         => 'plugin',
				'slug'         => $slug,
				'name'         => (string) $data['Name'],
				'version'      => (string) $data['Version'],
				'text_domain'  => $domain,
				'path'         => WP_PLUGIN_DIR . '/' . $slug,
				'string_count' => StringTranslator::count_strings( $domain ),
				'wp_org_hosted' => WporgImporter::is_hosted_plugin( $slug ),
			];
		}
		return $rows;
	}

	private function collect_themes() {
		$rows = [];
		foreach ( wp_get_themes() as $slug => $theme ) {
			$domain = (string) ( $theme->get( 'TextDomain' ) ?: $slug );
			$rows[] = [
				'type'          => 'theme',
				'slug'          => (string) $slug,
				'name'          => (string) $theme->get( 'Name' ),
				'version'       => (string) $theme->get( 'Version' ),
				'text_domain'   => $domain,
				'path'          => $theme->get_stylesheet_directory(),
				'string_count'  => StringTranslator::count_strings( $domain ),
				'wp_org_hosted' => WporgImporter::is_hosted_theme( (string) $slug ),
			];
		}
		return $rows;
	}

	public function scan_package( $request ) {
		$pkg = $this->resolve_package( (string) $request['slug'] );
		if ( is_wp_error( $pkg ) ) {
			return $pkg;
		}

		$scan = FileWalker::scan_directory( $pkg['path'] );

		// Pull existing WP.org translations into our table for all active languages.
		$languages = Context::active_languages();
		$default   = Context::default_code();
		$locales   = [];
		$codes     = [];
		foreach ( $languages as $code => $row ) {
			if ( $code === $default ) {
				continue;
			}
			$locales[] = (string) ( $row['locale'] ?? '' );
			$codes[]   = (string) $code;
		}
		$import = WporgImporter::import_for_package( $pkg['text_domain'], $locales, $codes );

		return $this->ok( array_merge( $scan, [
			'package'   => $pkg,
			'wporg'     => $import,
			'string_count' => StringTranslator::count_strings( $pkg['text_domain'] ),
		] ) );
	}

	// =====================================================================
	// Translation-readiness audit (missing/wrong text domain, hardcoded text)
	// =====================================================================

	const AUDIT_SUMMARIES_OPTION = 'gtrans_audit_summaries';
	const AUDIT_MAX_FINDINGS     = 400;

	private function audit_option( $slug ) {
		return 'gtrans_audit_' . sanitize_key( $slug );
	}

	/** Stored findings + summary for one package (null when never audited). */
	public function get_audit( $request ) {
		$pkg = $this->resolve_package( (string) $request['slug'] );
		if ( is_wp_error( $pkg ) ) {
			return $pkg;
		}
		$stored = get_option( $this->audit_option( $pkg['slug'] ), null );
		return $this->ok( $stored ?: null );
	}

	/**
	 * Run one chunk of the audit. The client calls this repeatedly, passing the
	 * returned `next_offset`, until `done` is true. offset=0 starts afresh.
	 */
	public function run_audit( $request ) {
		$pkg = $this->resolve_package( (string) $request['slug'] );
		if ( is_wp_error( $pkg ) ) {
			return $pkg;
		}
		$body   = $request->get_json_params() ?: $request->get_params();
		$offset = max( 0, (int) ( $body['offset'] ?? 0 ) );
		$key    = $this->audit_option( $pkg['slug'] );

		$chunk = Auditor::run_chunk( $pkg['path'], $pkg['text_domain'], $offset );

		$data = ( $offset > 0 ) ? get_option( $key, null ) : null;
		if ( ! is_array( $data ) ) {
			$data = [
				'counts'   => [ 'missing_domain' => 0, 'wrong_domain' => 0, 'hardcoded' => 0, 'calls' => 0 ],
				'findings' => [],
			];
		}
		foreach ( $chunk['counts'] as $type => $n ) {
			$data['counts'][ $type ] = ( $data['counts'][ $type ] ?? 0 ) + $n;
		}
		// Counts stay exact; the stored list is capped to keep the option small.
		$room = max( 0, self::AUDIT_MAX_FINDINGS - count( $data['findings'] ) );
		$data['findings'] = array_merge( $data['findings'], array_slice( $chunk['findings'], 0, $room ) );

		$data['text_domain']  = $pkg['text_domain'];
		$data['total_files']  = $chunk['total_files'];
		$data['scanned_files'] = $chunk['next_offset'];
		$data['truncated']    = $data['counts']['missing_domain'] + $data['counts']['wrong_domain'] + $data['counts']['hardcoded'] > count( $data['findings'] );
		$data['updated_at']   = time();
		update_option( $key, $data, false );

		if ( $chunk['done'] ) {
			$summaries = get_option( self::AUDIT_SUMMARIES_OPTION, [] );
			$summaries = is_array( $summaries ) ? $summaries : [];
			$summaries[ $pkg['slug'] ] = [
				'missing_domain' => $data['counts']['missing_domain'],
				'wrong_domain'   => $data['counts']['wrong_domain'],
				'hardcoded'      => $data['counts']['hardcoded'],
				'calls'          => $data['counts']['calls'],
				'updated_at'     => $data['updated_at'],
			];
			update_option( self::AUDIT_SUMMARIES_OPTION, $summaries, false );
		}

		return $this->ok( [
			'done'          => $chunk['done'],
			'next_offset'   => $chunk['next_offset'],
			'total_files'   => $chunk['total_files'],
			'audit'         => $chunk['done'] ? $data : null,
		] );
	}

	public function export_package( $request ) {
		$pkg = $this->resolve_package( (string) $request['slug'] );
		if ( is_wp_error( $pkg ) ) {
			return $pkg;
		}
		$lang = strtolower( (string) $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$locale = $this->locale_for( $lang );
		if ( '' === $locale ) {
			return $this->fail( 'gtrans_no_locale', __( 'Language has no locale configured.', 'gemtranslate' ), 422 );
		}

		$body    = $request->get_json_params() ?: $request->get_params();
		$exclude = (string) ( $body['exclude_status'] ?? '' );

		$result = PackGenerator::generate( $lang, $locale, [
			'domain'         => $pkg['text_domain'],
			'exclude_status' => $exclude,
		] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->ok( $result );
	}

	// =====================================================================
	// Helpers
	// =====================================================================

	private function resolve_package( $slug ) {
		$slug = sanitize_key( $slug );
		if ( '' === $slug ) {
			return $this->fail( 'gtrans_bad_slug', __( 'Invalid package slug.', 'gemtranslate' ), 422 );
		}
		// Try plugin first.
		foreach ( $this->collect_plugins() as $pkg ) {
			if ( $pkg['slug'] === $slug ) {
				return $pkg;
			}
		}
		foreach ( $this->collect_themes() as $pkg ) {
			if ( $pkg['slug'] === $slug ) {
				return $pkg;
			}
		}
		return $this->fail( 'gtrans_not_found', __( 'Package not found.', 'gemtranslate' ), 404 );
	}

	private function locale_for( $lang ) {
		$row = Context::active_languages()[ $lang ] ?? null;
		return $row ? (string) ( $row['locale'] ?? '' ) : '';
	}
}

<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\AI\TranslationMemory;
use Zentranslate\AI\TranslatorFactory;
use Zentranslate\I18n\PackGenerator;
use Zentranslate\I18n\WporgImporter;
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
			'/' . $this->rest_base . '/packages/(?P<slug>[A-Za-z0-9_\-]+)/(?P<lang>[a-z0-9\-]{2,10})/translate-all',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'translate_all_in_package' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
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

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/packages/(?P<slug>[A-Za-z0-9_\-]+)/(?P<lang>[a-z0-9\-]{2,10})/memory-suggestions',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'memory_suggestions' ],
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
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$body   = $request->get_json_params() ?: $request->get_params();
		$value  = (string) ( $body['value'] ?? '' );
		$status = (string) ( $body['status'] ?? 'translated' );
		$ok     = StringTranslator::save_translation( $id, $lang, $value, $status );
		if ( ! $ok ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not save translation.', 'zentranslate' ), 500 );
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
					return $this->fail( 'ztrans_bad_path', __( 'Directory does not exist.', 'zentranslate' ), 422 );
				}
				break;
			default:
				return $this->fail( 'ztrans_bad_target', __( 'Unknown scan target.', 'zentranslate' ), 422 );
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

		$packages = [];
		foreach ( $this->collect_plugins() as $pkg ) {
			$pkg['per_lang'] = StringTranslator::translation_progress( $pkg['text_domain'], $lang_codes );
			$packages[]     = $pkg;
		}
		foreach ( $this->collect_themes() as $pkg ) {
			$pkg['per_lang'] = StringTranslator::translation_progress( $pkg['text_domain'], $lang_codes );
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

	/**
	 * Bulk-AI-translate every untranslated row for a package in a language.
	 * Returns counts; uses TranslationMemory so already-translated-elsewhere
	 * strings are filled instantly without an AI call.
	 */
	public function translate_all_in_package( $request ) {
		// Bulk AI string translation (with TM + pack generation) is Pro; manual
		// per-string editing stays free.
		if ( $err = $this->require_pro( 'ai_bulk' ) ) {
			return $err;
		}
		$pkg = $this->resolve_package( (string) $request['slug'] );
		if ( is_wp_error( $pkg ) ) {
			return $pkg;
		}
		$lang = strtolower( (string) $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}

		$body         = $request->get_json_params() ?: $request->get_params();
		$status_value = (string) ( $body['status'] ?? 'draft' );

		// Find every untranslated row for this domain.
		$listing = StringTranslator::list_strings( [
			'domain'   => $pkg['text_domain'],
			'lang'     => $lang,
			'status'   => 'untranslated',
			'page'     => 1,
			'per_page' => 10000,
		] );
		$rows = $listing['rows'] ?? [];
		if ( empty( $rows ) ) {
			return $this->ok( [ 'translated' => 0, 'total' => 0, 'from_memory' => 0, 'from_ai' => 0 ] );
		}

		$source_lang = Context::default_code();
		$translator  = TranslatorFactory::default_translator();
		$from_memory = 0;
		$from_ai     = 0;
		$translated  = 0;

		// First pass: TranslationMemory.
		$ai_queue = [];
		foreach ( $rows as $row ) {
			$source = (string) $row['source'];
			$cached = TranslationMemory::get( $source, $source_lang, $lang );
			if ( null !== $cached && '' !== $cached ) {
				if ( StringTranslator::save_translation( (int) $row['string_id'], $lang, $cached, $status_value ) ) {
					$from_memory++;
					$translated++;
				}
			} elseif ( $translator ) {
				$ai_queue[ (int) $row['string_id'] ] = $source;
			}
		}

		// Second pass: AI in batches.
		if ( $translator && ! empty( $ai_queue ) ) {
			$ids   = array_keys( $ai_queue );
			$texts = array_values( $ai_queue );
			foreach ( array_chunk( $texts, 25, true ) as $chunk_offset => $chunk ) {
				$result = $translator->translate( $chunk, $source_lang, $lang, [ 'preserve_html' => false ] );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
				foreach ( $chunk as $rel_i => $text ) {
					$abs_i = $chunk_offset * 25 + $rel_i;
					$value = $result['translations'][ $rel_i ] ?? '';
					if ( '' === $value || ! isset( $ids[ $abs_i ] ) ) {
						continue;
					}
					if ( StringTranslator::save_translation( $ids[ $abs_i ], $lang, $value, $status_value ) ) {
						$from_ai++;
						$translated++;
						TranslationMemory::set( $text, $value, $source_lang, $lang, $result['provider'] ?? '' );
					}
				}
			}
		}

		return $this->ok( [
			'translated'  => $translated,
			'total'       => count( $rows ),
			'from_memory' => $from_memory,
			'from_ai'     => $from_ai,
		] );
	}

	public function export_package( $request ) {
		$pkg = $this->resolve_package( (string) $request['slug'] );
		if ( is_wp_error( $pkg ) ) {
			return $pkg;
		}
		$lang = strtolower( (string) $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$locale = $this->locale_for( $lang );
		if ( '' === $locale ) {
			return $this->fail( 'ztrans_no_locale', __( 'Language has no locale configured.', 'zentranslate' ), 422 );
		}

		$body          = $request->get_json_params() ?: $request->get_params();
		$exclude       = (string) ( $body['exclude_status'] ?? '' );
		$ai_fill       = isset( $body['ai_fill'] ) ? (bool) $body['ai_fill'] : false;

		$result = PackGenerator::generate( $lang, $locale, [
			'domain'         => $pkg['text_domain'],
			'ai_fill'        => $ai_fill,
			'exclude_status' => $exclude,
		] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->ok( $result );
	}

	public function memory_suggestions( $request ) {
		if ( $err = $this->require_pro( 'translation_memory' ) ) {
			return $err;
		}
		$lang = strtolower( (string) $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'ztrans_invalid_lang', __( 'Language is not active.', 'zentranslate' ), 422 );
		}
		$body       = $request->get_json_params() ?: $request->get_params();
		$string_ids = array_map( 'intval', (array) ( $body['string_ids'] ?? [] ) );
		if ( empty( $string_ids ) ) {
			return $this->ok( new \stdClass() );
		}

		// Fetch source text for each id, then probe TM.
		global $wpdb;
		$table = \Zentranslate\Helper::table( 'strings' );
		$placeholders = implode( ',', array_fill( 0, count( $string_ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT string_id, source FROM $table WHERE string_id IN ($placeholders)", $string_ids ),
			ARRAY_A
		) ?: [];

		$source_lang = Context::default_code();
		$out = [];
		foreach ( $rows as $r ) {
			$hit = TranslationMemory::get( (string) $r['source'], $source_lang, $lang );
			if ( null !== $hit && '' !== $hit ) {
				$out[ (string) (int) $r['string_id'] ] = (string) $hit;
			}
		}
		return $this->ok( $out ?: new \stdClass() );
	}

	// =====================================================================
	// Helpers
	// =====================================================================

	private function resolve_package( $slug ) {
		$slug = sanitize_key( $slug );
		if ( '' === $slug ) {
			return $this->fail( 'ztrans_bad_slug', __( 'Invalid package slug.', 'zentranslate' ), 422 );
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
		return $this->fail( 'ztrans_not_found', __( 'Package not found.', 'zentranslate' ), 404 );
	}

	private function locale_for( $lang ) {
		$row = Context::active_languages()[ $lang ] ?? null;
		return $row ? (string) ( $row['locale'] ?? '' ) : '';
	}
}

<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Translation\BlockParser;
use GemTranslate\Translation\BlockUnits;
use GemTranslate\Translation\ElementorTranslator;
use GemTranslate\Translation\MetaTranslator;
use GemTranslate\Translation\PostFieldTranslator;
use GemTranslate\Translation\ShadowPostSync;
use GemTranslate\Translation\TranslationLoader;
use GemTranslate\Translation\TranslationHistory;

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
				'permission_callback' => [ $this, 'permissions_translate_post' ],
			]
		);

		// List posts with translation status per language.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'index' ],
				'permission_callback' => [ $this, 'permissions_translate_post' ],
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
				'permission_callback' => [ $this, 'permissions_translate_post' ],
			]
		);

		// String-only field list endpoints (v1.3).
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/fields/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_fields' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_fields' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
			]
		);

		// Block-wise units (Gutenberg blocks / Elementor widget settings).
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/units/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_units' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_units' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
			]
		);

		// Per-segment "confirmed" state for the Advanced editor (post-meta backed,
		// no schema change). Body/response: { confirmed: [ "<hash>", … ] }.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/segments/(?P<lang>[a-z0-9\-]{2,10})/confirmed',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_confirmed_segments' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_confirmed_segments' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
			]
		);

		// Mode-flip endpoints.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})/promote-to-layout',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'promote_to_layout' ],
				'permission_callback' => [ $this, 'permissions_translate_post' ],
			]
		);
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})/demote-to-strings',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'demote_to_strings' ],
				'permission_callback' => [ $this, 'permissions_translate_post' ],
			]
		);

		// Country-variant management.
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/variants/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'list_variants' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create_variant' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/meta-translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_meta' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_meta' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'show_translation' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_translation' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_translation' ],
					'permission_callback' => [ $this, 'permissions_translate_post' ],
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
			if ( ! current_user_can( $type->cap->edit_posts ?? 'edit_posts' ) && ! current_user_can( self::CAP_TRANSLATE ) ) {
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
		$post_type = $request->get_param( 'post_type' ) ?: 'post';

		// Only public post types are translatable; anything else (orders,
		// templates, other plugins' private types) must not be enumerable here.
		$type_object = get_post_type_object( $post_type );
		if ( ! $type_object || ! $type_object->public || 'attachment' === $post_type ) {
			return $this->fail( 'gtrans_bad_post_type', __( 'Unknown or non-translatable post type.', 'gemtranslate' ), 422 );
		}
		$can_edit_type = current_user_can( $type_object->cap->edit_posts ?? 'edit_posts' );

		// Academy LMS stores lessons in a custom table when HP lesson mode is active.
		if ( 'academy_lessons' === $post_type && $this->is_academy_hp_mode() ) {
			return $this->index_academy_hp_lessons( $request );
		}

		$args = [
			'post_type'      => $post_type,
			'post_status'    => $can_edit_type ? ( $request->get_param( 'status' ) ?: 'any' ) : 'publish',
			'posts_per_page' => max( 1, min( 100, (int) $request->get_param( 'per_page' ) ) ),
			'paged'          => max( 1, (int) $request->get_param( 'page' ) ),
			's'              => (string) $request->get_param( 'search' ),
			'orderby'        => 'date',
			'order'          => 'DESC',
		];

		if ( ! $can_edit_type ) {
			// Translators without edit rights never see protected posts.
			$args['has_password'] = false;
		}

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

	/**
	 * Query the Academy LMS custom lessons table directly (HP lesson mode).
	 * Called from index() when post_type=academy_lesson and HP mode is active.
	 */
	private function index_academy_hp_lessons( $request ) {
		global $wpdb;
		$per_page = max( 1, min( 100, (int) $request->get_param( 'per_page' ) ) );
		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$search   = (string) $request->get_param( 'search' );
		$status   = (string) ( $request->get_param( 'status' ) ?: 'any' );
		$offset   = ( $page - 1 ) * $per_page;
		$table    = $wpdb->prefix . 'academy_lessons';

		$wheres = [];
		$params = [];

		if ( '' !== $search ) {
			$wheres[] = 'lesson_title LIKE %s';
			$params[] = '%' . $wpdb->esc_like( $search ) . '%';
		}
		if ( 'any' !== $status ) {
			$wheres[] = 'lesson_status = %s';
			$params[] = $status;
		}

		$where_sql    = $wheres ? 'WHERE ' . implode( ' AND ', $wheres ) : '';
		$count_params = $params;

		$params[] = $per_page;
		$params[] = $offset;

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$list_sql  = "SELECT ID, lesson_title, lesson_name, lesson_status, lesson_modified_gmt FROM {$table} {$where_sql} ORDER BY ID DESC LIMIT %d OFFSET %d";
		$count_sql = "SELECT COUNT(*) FROM {$table} {$where_sql}";
		// phpcs:enable

		$db_rows = $params
			? $wpdb->get_results( $wpdb->prepare( $list_sql, ...$params ), ARRAY_A ) // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			: $wpdb->get_results( $list_sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$db_rows = $db_rows ?: [];

		$total = $count_params
			? (int) $wpdb->get_var( $wpdb->prepare( $count_sql, ...$count_params ) ) // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			: (int) $wpdb->get_var( $count_sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		$rows = [];
		foreach ( $db_rows as $row ) {
			$id      = (int) $row['ID'];
			$rows[] = [
				'id'                  => $id,
				'title'               => $row['lesson_title'],
				'slug'                => $row['lesson_name'],
				'status'              => $row['lesson_status'],
				'type'                => 'academy_lessons',
				'modified'            => $row['lesson_modified_gmt'],
				'translations_status' => TranslationLoader::status_map( $id ),
			];
		}

		return $this->ok(
			$rows,
			[
				'total'       => $total,
				'total_pages' => (int) ceil( $total / $per_page ),
				'page'        => $page,
				'per_page'    => $per_page,
			]
		);
	}

	/**
	 * Return a fake WP_Post-like stdClass for an Academy HP lesson row.
	 * Used so the translation endpoints can work with HP lesson IDs.
	 */
	private function get_academy_hp_lesson_as_post( int $id ): ?\stdClass {
		if ( ! $this->is_academy_hp_mode() ) {
			return null;
		}
		global $wpdb;
		$table = $wpdb->prefix . 'academy_lessons';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE ID = %d", $id ), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		$obj                     = new \stdClass();
		$obj->ID                 = (int) $row['ID'];
		$obj->post_title         = $row['lesson_title'];
		$obj->post_name          = $row['lesson_name'];
		$obj->post_status        = $row['lesson_status'];
		$obj->post_type          = 'academy_lessons';
		$obj->post_content       = $row['lesson_content'] ?? '';
		$obj->post_excerpt       = $row['lesson_excerpt'] ?? '';
		$obj->post_modified_gmt  = $row['lesson_modified_gmt'];
		return $obj;
	}

	private function is_academy_hp_mode(): bool {
		return defined( 'ACADEMY_PLUGIN_SLUG' )
			&& (bool) ( $GLOBALS['academy_settings']->academy_is_hp_lesson_active ?? true );
	}

	public function get_translations( $request ) {
		$post_id = (int) $request['id'];
		$post    = get_post( $post_id ) ?? $this->get_academy_hp_lesson_as_post( $post_id );
		if ( ! $post ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}

		// Group rows by language; default-country row is the "primary".
		$existing  = [];
		foreach ( TranslationLoader::all_for_post( $post_id ) as $row ) {
			$lang    = (string) $row['language_code'];
			$country = (string) ( $row['country_code'] ?? '' );
			if ( ! isset( $existing[ $lang ] ) || '' === $country ) {
				$existing[ $lang ] = $this->prepare_translation_row( $row );
			}
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
		$country = $this->country_param( $request );
		$rows    = TranslationLoader::variants_for_post( $post_id, $lang );

		// Exact (lang, country) match first; fall back to language-default.
		$match = null;
		foreach ( $rows as $row ) {
			if ( (string) $row['country_code'] === $country ) {
				$match = $row;
				break;
			}
		}
		if ( ! $match ) {
			foreach ( $rows as $row ) {
				if ( '' === (string) $row['country_code'] ) {
					$match = $row;
					break;
				}
			}
		}
		if ( ! $match ) {
			return $this->fail( 'gtrans_not_found', __( 'Translation not found.', 'gemtranslate' ), 404 );
		}
		return $this->ok( $this->prepare_translation_row( $match ) );
	}

	public function save_translation( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		if ( ! get_post( $post_id ) && ! $this->get_academy_hp_lesson_as_post( $post_id ) ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}

		$body    = $request->get_json_params() ?: $request->get_params();
		$country = $this->country_param( $request );
		$ok      = TranslationLoader::save_translation( $post_id, $lang, [
			'title'            => $body['title']            ?? '',
			'content'          => $body['content']          ?? '',
			'excerpt'          => $body['excerpt']          ?? '',
			'slug'             => $body['slug']             ?? '',
			'status'           => $body['status']           ?? 'publish',
			'country_code'     => $body['country_code']     ?? $country,
			'translation_mode' => $body['translation_mode'] ?? TranslationLoader::MODE_CUSTOM_LAYOUT,
		] );
		if ( ! $ok ) {
			return $this->fail( 'gtrans_save_failed', __( 'Could not save translation.', 'gemtranslate' ), 500 );
		}
		return $this->show_translation( $request );
	}

	public function delete_translation( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$country = $this->country_param( $request );
		// If no explicit country was passed, drop every variant for the language;
		// otherwise drop just that variant.
		$has_explicit_country = null !== $request->get_param( 'country' );
		TranslationLoader::delete_translation( $post_id, $lang, $has_explicit_country ? $country : null );
		return $this->ok( [ 'deleted' => true, 'post_id' => $post_id, 'language_code' => $lang, 'country_code' => $country ] );
	}

	// -----------------------------------------------------------------------
	// String-only field list (v1.3)
	// -----------------------------------------------------------------------

	public function get_fields( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$post    = get_post( $post_id ) ?? $this->get_academy_hp_lesson_as_post( $post_id );
		if ( ! $post ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}
		$fields = PostFieldTranslator::enumerate_fields( $post, $lang );
		return $this->ok( [
			'is_block_content' => BlockParser::is_block_content( (string) $post->post_content ),
			'fields'           => $fields,
			'mode'             => TranslationLoader::MODE_STRING_ONLY,
		] );
	}

	public function save_fields( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$post = get_post( $post_id ) ?? $this->get_academy_hp_lesson_as_post( $post_id );
		if ( ! $post ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}

		$body    = $request->get_json_params() ?: $request->get_params();
		$rows    = (array) ( $body['fields'] ?? [] );
		$country = $this->country_param( $request );
		$saved   = 0;

		// Revision history is a Pro feature. "Strings only" mode (the default
		// editor) has no single title/content blob to snapshot the way the
		// Custom layout save path does — the translated values live per-string
		// in wp_gtrans_string_translations — so snapshot the current field map
		// here before this batch overwrites it.
		if ( class_exists( TranslationHistory::class ) && ! empty( $rows ) ) {
			TranslationHistory::snapshot_string_fields( $post_id, $lang, $country );
		}

		foreach ( $rows as $r ) {
			$path        = (string) ( $r['path'] ?? '' );
			$translation = (string) ( $r['value'] ?? '' );
			$source      = (string) ( $r['source'] ?? '' );
			// An image path (`….html.src`) stores a replacement URL, not text.
			if ( '.html.src' === substr( $path, -9 ) ) {
				$translation = esc_url_raw( $translation );
			}
			if ( '' === $path ) {
				continue;
			}
			if ( '' === $source ) {
				$source = $this->derive_source_for_path( $post, $path );
			}
			if ( TranslationLoader::save_string_translation( $post_id, $lang, $path, $source, $translation, $country ) ) {
				$saved++;
			}
		}
		PostFieldTranslator::flush_memo();

		return $this->get_fields( $request );
	}

	public function get_units( $request ) {
		$post = get_post( (int) $request['id'] );
		if ( ! $post ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}
		return $this->ok( BlockUnits::enumerate( $post, strtolower( $request['lang'] ) ) );
	}

	public function save_units( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$post = get_post( $post_id );
		if ( ! $post ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}

		$body    = $request->get_json_params() ?: $request->get_params();
		$rows    = (array) ( $body['units'] ?? [] );
		$country = $this->country_param( $request );

		if ( class_exists( TranslationHistory::class ) && ! empty( $rows ) ) {
			TranslationHistory::snapshot_string_fields( $post_id, $lang, $country );
		}

		// Resolve every id against the live source so the storage key can't be
		// forged or drift from what the render path derives.
		$sources = [];
		$images  = [];
		foreach ( BlockUnits::enumerate( $post, $lang )['units'] as $u ) {
			$sources[ $u['id'] ] = $u['source'];
			if ( 'image' === $u['kind'] ) {
				$images[ $u['id'] ] = true;
			}
		}
		foreach ( $rows as $r ) {
			$id = (string) ( $r['id'] ?? '' );
			if ( '' === $id || ! isset( $sources[ $id ] ) ) {
				continue;
			}
			$value = (string) ( $r['value'] ?? '' );
			// An image unit stores a replacement URL, not text.
			if ( isset( $images[ $id ] ) ) {
				$value = esc_url_raw( $value );
			}
			TranslationLoader::save_string_translation( $post_id, $lang, $id, $sources[ $id ], $value, $country );
		}
		PostFieldTranslator::flush_memo();
		ElementorTranslator::flush_memo();

		return $this->get_units( $request );
	}

	/**
	 * Post-meta key holding the set of confirmed segment hashes for a
	 * (language, country) pair. Country-default uses the bare lang suffix.
	 */
	private function confirmed_meta_key( $lang, $country ) {
		$suffix = $country ? $lang . '_' . strtolower( $country ) : $lang;
		return '_gtrans_seg_confirmed_' . $suffix;
	}

	public function get_confirmed_segments( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$country = $this->country_param( $request );
		if ( ! get_post( $post_id ) ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}
		$stored = get_post_meta( $post_id, $this->confirmed_meta_key( $lang, $country ), true );
		$list   = is_array( $stored ) ? array_values( array_filter( array_map( 'strval', $stored ) ) ) : [];
		return $this->ok( [ 'confirmed' => $list ] );
	}

	public function save_confirmed_segments( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$country = $this->country_param( $request );
		if ( ! get_post( $post_id ) ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}
		$body = $request->get_json_params() ?: $request->get_params();
		$raw  = (array) ( $body['confirmed'] ?? [] );
		// Segment hashes are hex SHA-1 (40 chars) produced client-side; keep the
		// stored set clean and bounded.
		$clean = [];
		foreach ( $raw as $h ) {
			$h = (string) $h;
			if ( preg_match( '/^[a-f0-9]{6,64}$/', $h ) ) {
				$clean[ $h ] = true;
			}
		}
		$clean = array_slice( array_keys( $clean ), 0, 2000 );
		update_post_meta( $post_id, $this->confirmed_meta_key( $lang, $country ), $clean );
		return $this->ok( [ 'confirmed' => $clean ] );
	}

	/**
	 * Return the tokenised source value for a given path. This IS the storage
	 * key used by `save_string_translation` — must match what the render path
	 * (PostFieldTranslator) extracts from the same source.
	 *
	 * For block fields, the raw innerHTML is tokenised via TokenExtractor so
	 * the key is `Hello {1}world{2}` rather than the raw `<p>Hello <strong>world</strong></p>`.
	 */
	private function derive_source_for_path( $post, $path ) {
		$raw = '';
		if ( PostFieldTranslator::PATH_TITLE === $path ) {
			$raw = (string) $post->post_title;
		} elseif ( PostFieldTranslator::PATH_EXCERPT === $path ) {
			$raw = (string) $post->post_excerpt;
		} elseif ( PostFieldTranslator::PATH_BODY === $path ) {
			$raw = (string) $post->post_content;
		} else {
			foreach ( BlockParser::extract( (string) $post->post_content ) as $field ) {
				if ( $field['path'] === $path ) {
					$raw = (string) $field['value'];
					break;
				}
			}
		}
		return PostFieldTranslator::tokenise( $raw );
	}

	// -----------------------------------------------------------------------
	// Mode flips
	// -----------------------------------------------------------------------

	public function promote_to_layout( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$country = $this->country_param( $request );
		$post    = get_post( $post_id );
		if ( ! $post ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}
		// Snapshot current rendered string-only output as the starting custom layout.
		$rebuilt = PostFieldTranslator::rebuild_content( $post_id, (string) $post->post_content, $lang );
		$title   = PostFieldTranslator::translated_title( $post_id, (string) $post->post_title, $lang );
		$excerpt = PostFieldTranslator::translated_excerpt( $post_id, (string) $post->post_excerpt, $lang );

		// Create (or reuse) the shadow WP post that the admin will edit in
		// Gutenberg / page builder. ensure_for() also writes the row.
		$shadow_id = ShadowPostSync::ensure_for(
			$post_id,
			$lang,
			$country,
			[
				'title'   => $title,
				'content' => $rebuilt,
				'excerpt' => $excerpt,
				'slug'    => (string) $post->post_name,
			]
		);
		if ( ! $shadow_id ) {
			return $this->fail( 'gtrans_save_failed', __( 'Could not create shadow post.', 'gemtranslate' ), 500 );
		}
		return $this->show_translation( $request );
	}

	public function demote_to_strings( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$country = $this->country_param( $request );

		// Extract per-field translations from the stored content blob, register
		// them as strings, then clear the content so the render path falls
		// through to string_only mode.
		$existing = null;
		foreach ( TranslationLoader::variants_for_post( $post_id, $lang ) as $row ) {
			if ( (string) $row['country_code'] === $country ) {
				$existing = $row;
				break;
			}
		}
		if ( $existing ) {
			$stored = (string) $existing['content'];
			if ( BlockParser::is_block_content( $stored ) ) {
				$src_post   = get_post( $post_id );
				$stored_map = [];
				foreach ( BlockParser::extract( $stored ) as $field ) {
					$stored_map[ $field['path'] ] = (string) $field['value'];
				}
				foreach ( BlockParser::extract( (string) $src_post->post_content ) as $field ) {
					$src_key = $this->derive_source_for_path( $src_post, $field['path'] );
					$value   = PostFieldTranslator::tokenise( $stored_map[ $field['path'] ] ?? '' );
					if ( '' === $src_key || '' === $value ) {
						continue;
					}
					TranslationLoader::save_string_translation( $post_id, $lang, $field['path'], $src_key, $value, $country );
				}
			} elseif ( '' !== $stored ) {
				TranslationLoader::save_string_translation(
					$post_id,
					$lang,
					PostFieldTranslator::PATH_BODY,
					$this->derive_source_for_path( get_post( $post_id ), PostFieldTranslator::PATH_BODY ),
					PostFieldTranslator::tokenise( $stored ),
					$country
				);
			}
			$title = (string) $existing['title'];
			if ( '' !== $title ) {
				TranslationLoader::save_string_translation(
					$post_id,
					$lang,
					PostFieldTranslator::PATH_TITLE,
					$this->derive_source_for_path( get_post( $post_id ), PostFieldTranslator::PATH_TITLE ),
					PostFieldTranslator::tokenise( $title ),
					$country
				);
			}
			$excerpt = (string) $existing['excerpt'];
			if ( '' !== $excerpt ) {
				TranslationLoader::save_string_translation(
					$post_id,
					$lang,
					PostFieldTranslator::PATH_EXCERPT,
					$this->derive_source_for_path( get_post( $post_id ), PostFieldTranslator::PATH_EXCERPT ),
					PostFieldTranslator::tokenise( $excerpt ),
					$country
				);
			}
		}

		$ok = TranslationLoader::save_translation(
			$post_id,
			$lang,
			[
				'title'            => '',
				'content'          => '',
				'excerpt'          => '',
				'slug'             => $existing['slug']   ?? (string) get_post_field( 'post_name', $post_id ),
				'status'           => $existing['status'] ?? 'publish',
				'country_code'     => $country,
				'translation_mode' => TranslationLoader::MODE_STRING_ONLY,
				'shadow_post_id'   => 0,
			]
		);
		if ( ! $ok ) {
			return $this->fail( 'gtrans_save_failed', __( 'Could not demote translation.', 'gemtranslate' ), 500 );
		}
		// Trash the shadow post; admin can restore from wp-admin Trash if needed.
		ShadowPostSync::trash_for( $post_id, $lang, $country );
		PostFieldTranslator::flush_memo();
		return $this->show_translation( $request );
	}

	// -----------------------------------------------------------------------
	// Country variants
	// -----------------------------------------------------------------------

	public function list_variants( $request ) {
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$rows    = TranslationLoader::variants_for_post( $post_id, $lang );
		$out     = array_map( [ $this, 'prepare_translation_row' ], $rows );
		return $this->ok( $out );
	}

	public function create_variant( $request ) {
		if ( $err = $this->require_pro( 'country_variants' ) ) {
			return $err;
		}
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		$body    = $request->get_json_params() ?: $request->get_params();
		$country = strtoupper( (string) ( $body['country_code'] ?? '' ) );
		if ( ! preg_match( '/^[A-Z]{2}$/', $country ) ) {
			return $this->fail( 'gtrans_invalid_country', __( 'country_code must be an ISO 3166-1 alpha-2 code.', 'gemtranslate' ), 422 );
		}
		// Seed from the language-default row if one exists.
		$seed = null;
		foreach ( TranslationLoader::variants_for_post( $post_id, $lang ) as $row ) {
			if ( '' === (string) $row['country_code'] ) {
				$seed = $row;
				break;
			}
		}
		$ok = TranslationLoader::save_translation(
			$post_id,
			$lang,
			[
				'title'            => $seed['title']   ?? '',
				'content'          => $seed['content'] ?? '',
				'excerpt'          => $seed['excerpt'] ?? '',
				'slug'             => $seed['slug']    ?? '',
				'status'           => $seed['status']  ?? 'publish',
				'country_code'     => $country,
				'translation_mode' => $seed['translation_mode'] ?? TranslationLoader::MODE_STRING_ONLY,
			]
		);
		if ( ! $ok ) {
			return $this->fail( 'gtrans_save_failed', __( 'Could not create country variant.', 'gemtranslate' ), 500 );
		}
		return $this->list_variants( $request );
	}

	// -----------------------------------------------------------------------
	// Custom meta (unchanged)
	// -----------------------------------------------------------------------

	public function get_meta( $request ) {
		if ( $err = $this->require_pro( 'custom_fields' ) ) {
			return $err;
		}
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! get_post( $post_id ) && ! $this->get_academy_hp_lesson_as_post( $post_id ) ) {
			return $this->fail( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), 404 );
		}

		$fields       = MetaTranslator::enumerate_fields( $post_id );
		$translations = MetaTranslator::all_for_post( $post_id, $lang );
		$by_key       = [];
		foreach ( $translations as $row ) {
			$by_key[ $row['meta_key'] ] = $row['meta_value'];
		}
		$out = [];
		foreach ( $fields as $f ) {
			$out[] = [
				'key'         => $f['key'],
				'label'       => $f['label'],
				'type'        => $f['type'],
				'source'      => $f['value'],
				'translation' => $by_key[ $f['key'] ] ?? '',
			];
		}
		return $this->ok( $out );
	}

	public function save_meta( $request ) {
		if ( $err = $this->require_pro( 'custom_fields' ) ) {
			return $err;
		}
		$post_id = (int) $request['id'];
		$lang    = strtolower( $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$body = $request->get_json_params() ?: $request->get_params();
		$rows = (array) ( $body['fields'] ?? [] );
		$saved = 0;
		foreach ( $rows as $r ) {
			$key   = (string) ( $r['key'] ?? '' );
			$value = (string) ( $r['value'] ?? '' );
			if ( '' === $key ) {
				continue;
			}
			if ( '' === $value ) {
				MetaTranslator::delete( $post_id, $lang, $key );
				continue;
			}
			if ( MetaTranslator::save( $post_id, $lang, $key, $value ) ) {
				$saved++;
			}
		}
		return $this->ok( [ 'saved' => $saved ] );
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	private function country_param( $request ) {
		$raw = (string) $request->get_param( 'country' );
		if ( '' === $raw && ! ( $request instanceof \WP_REST_Request ) ) {
			return '';
		}
		$raw = strtoupper( $raw );
		return preg_match( '/^[A-Z]{2}$/', $raw ) ? $raw : '';
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
			$out['builder'] = $post instanceof \WP_Post ? BlockUnits::detect_builder( $post ) : BlockUnits::BUILDER_CLASSIC;
		}
		return $out;
	}

	private function prepare_translation_row( $row ) {
		$shadow_id = (int) ( $row['shadow_post_id'] ?? 0 );
		return [
			'group_id'         => (int) $row['group_id'],
			'language_code'    => $row['language_code'],
			'country_code'     => (string) ( $row['country_code'] ?? '' ),
			'post_id'          => (int) $row['post_id'],
			'shadow_post_id'   => $shadow_id,
			'shadow_edit_url'  => $shadow_id ? ShadowPostSync::edit_url( $shadow_id ) : '',
			'title'            => $row['title'],
			'content'          => $row['content'],
			'excerpt'          => $row['excerpt'],
			'slug'             => $row['slug'],
			'status'           => $row['status'],
			'translation_mode' => $row['translation_mode'] ?? TranslationLoader::MODE_CUSTOM_LAYOUT,
			'updated_at'       => $row['updated_at'],
		];
	}
}

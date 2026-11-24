<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;

class Stats extends Controller {

	protected $rest_base = 'stats';

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
				'callback'            => [ $this, 'show' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);
	}

	public function show() {
		global $wpdb;

		$languages = Context::active_languages();
		$default   = Context::default_code();

		$post_translations = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i', Helper::table( 'post_translations' ) ) );
		$term_translations = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i', Helper::table( 'term_translations' ) ) );
		$strings_total     = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i', Helper::table( 'strings' ) ) );
		$strings_translated = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(DISTINCT string_id) FROM %i WHERE value <> ''", Helper::table( 'string_translations' ) ) );

		// Per-language post coverage.
		$per_lang = [];
		foreach ( $languages as $code => $lang ) {
			if ( $code === $default ) {
				continue;
			}
			$count = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM %i WHERE language_code = %s AND status = 'publish'",
					Helper::table( 'post_translations' ),
					$code
				)
			);
			$per_lang[ $code ] = [ 'language' => $lang, 'translated_posts' => $count ];
		}

		return $this->ok(
			[
				'languages_active'  => count( $languages ),
				'post_translations' => $post_translations,
				'term_translations' => $term_translations,
				'strings_total'     => $strings_total,
				'strings_translated' => $strings_translated,
				'per_language'      => $per_lang,
			]
		);
	}
}

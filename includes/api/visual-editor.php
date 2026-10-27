<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Translation\PostFieldTranslator;
use GemTranslate\Translation\TranslationLoader;

/**
 * REST endpoint for the frontend visual translation editor.
 * Takes {source, translation, post_id, lang} and saves a string-only
 * translation. Capability-gated to gtrans_translate_content.
 */
class VisualEditor {

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			GTRANS_REST_NAMESPACE,
			'/visual-editor/save',
			[
				'methods'             => 'POST',
				'permission_callback' => [ $this, 'can' ],
				'callback'            => [ $this, 'save' ],
				'args'                => [
					'post_id'     => [ 'type' => 'integer', 'required' => true ],
					'lang'        => [ 'type' => 'string',  'required' => true ],
					'source'      => [ 'type' => 'string',  'required' => true ],
					'translation' => [ 'type' => 'string',  'required' => true ],
				],
			]
		);
	}

	public function can() {
		return current_user_can( 'gtrans_translate_content' ) || current_user_can( 'manage_options' );
	}

	public function save( \WP_REST_Request $req ) {
		$post_id     = (int) $req->get_param( 'post_id' );
		$lang        = strtolower( (string) $req->get_param( 'lang' ) );
		$source      = (string) $req->get_param( 'source' );
		$translation = (string) $req->get_param( 'translation' );

		if ( $post_id <= 0 || ! get_post( $post_id ) ) {
			return new \WP_Error( 'gtrans_not_found', __( 'Post not found.', 'gemtranslate' ), [ 'status' => 404 ] );
		}
		if ( ! Context::is_active( $lang ) ) {
			return new \WP_Error( 'gtrans_invalid_lang', __( 'Language not active.', 'gemtranslate' ), [ 'status' => 422 ] );
		}
		if ( '' === trim( $source ) ) {
			return new \WP_Error( 'gtrans_invalid_source', __( 'Empty source.', 'gemtranslate' ), [ 'status' => 422 ] );
		}

		$ok = TranslationLoader::save_string_translation(
			$post_id,
			$lang,
			PostFieldTranslator::PATH_BODY,
			$source,
			$translation,
			''
		);
		if ( ! $ok ) {
			return new \WP_Error( 'gtrans_save_failed', __( 'Could not save.', 'gemtranslate' ), [ 'status' => 500 ] );
		}
		return rest_ensure_response( [ 'ok' => true ] );
	}
}

<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Translation\EditorContext;

/**
 * Swaps post fields (title, content, excerpt) for the current language via
 * post-fetch filters. Never modifies WP_Query.
 *
 * Two render modes:
 *   - `custom_layout` — returns the stored translated content blob as-is.
 *   - `string_only`   — re-walks the *current* source blocks and applies stored
 *                       string translations on the fly via PostFieldTranslator.
 *                       Layout edits to the source self-heal on the translated
 *                       page because the structure always tracks the source.
 */
class PostTranslator {

	public static function init() {
		$self = new self();
		add_filter( 'the_title', [ $self, 'filter_title' ], 10, 2 );
		add_filter( 'the_content', [ $self, 'filter_content' ], 5 );
		add_filter( 'the_excerpt', [ $self, 'filter_excerpt' ], 5 );
		add_filter( 'get_the_excerpt', [ $self, 'filter_excerpt' ], 5, 2 );
		add_filter( 'single_post_title', [ $self, 'filter_title' ], 10, 2 );

		// Invalidate cache when a translation's source changes.
		add_action( 'save_post', [ $self, 'on_post_saved' ], 10, 3 );
		add_action( 'before_delete_post', [ $self, 'on_post_deleted' ] );
	}

	public function filter_title( $title, $post_id_or_post = null ) {
		if ( Context::is_default() || EditorContext::is_render_target() ) {
			return $title;
		}
		$post_id = $this->resolve_post_id( $post_id_or_post );
		if ( ! $post_id ) {
			return $title;
		}
		$row = TranslationLoader::get_for_post( $post_id );
		if ( ! $row ) {
			return $title;
		}
		if ( TranslationLoader::MODE_STRING_ONLY === ( $row['translation_mode'] ?? '' ) ) {
			return PostFieldTranslator::translated_title( $post_id, $title, Context::current() );
		}
		if ( '' !== (string) $row['title'] ) {
			return $row['title'];
		}
		return $title;
	}

	public function filter_content( $content ) {
		if ( Context::is_default() || EditorContext::is_render_target() ) {
			return $content;
		}
		global $post;
		if ( ! $post ) {
			return $content;
		}
		$row = TranslationLoader::get_for_post( $post->ID );
		if ( ! $row ) {
			return $content;
		}
		if ( TranslationLoader::MODE_STRING_ONLY === ( $row['translation_mode'] ?? '' ) ) {
			return PostFieldTranslator::rebuild_content( $post->ID, $content, Context::current() );
		}
		if ( '' !== (string) $row['content'] ) {
			return $row['content'];
		}
		return $content;
	}

	public function filter_excerpt( $excerpt, $post = null ) {
		if ( Context::is_default() || EditorContext::is_render_target() ) {
			return $excerpt;
		}
		$post_id = $this->resolve_post_id( $post );
		if ( ! $post_id ) {
			global $post;
			$post_id = $post ? $post->ID : 0;
		}
		if ( ! $post_id ) {
			return $excerpt;
		}
		$row = TranslationLoader::get_for_post( $post_id );
		if ( ! $row ) {
			return $excerpt;
		}
		if ( TranslationLoader::MODE_STRING_ONLY === ( $row['translation_mode'] ?? '' ) ) {
			return PostFieldTranslator::translated_excerpt( $post_id, $excerpt, Context::current() );
		}
		if ( '' !== (string) $row['excerpt'] ) {
			return $row['excerpt'];
		}
		return $excerpt;
	}

	public function on_post_saved( $post_id, $post = null, $update = null ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		TranslationLoader::invalidate_post( $post_id );
		PostFieldTranslator::flush_memo();
	}

	public function on_post_deleted( $post_id ) {
		TranslationLoader::invalidate_post( $post_id );
		PostFieldTranslator::flush_memo();
	}

	private function resolve_post_id( $maybe ) {
		if ( is_numeric( $maybe ) ) {
			return (int) $maybe;
		}
		if ( $maybe instanceof \WP_Post ) {
			return (int) $maybe->ID;
		}
		return 0;
	}
}

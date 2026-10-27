<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;

/**
 * Frontend visual translation editor. Admin users (gtrans_translate_content)
 * get a floating "Translate this page" toggle. When active, every text node
 * inside the main content container gets a dashed outline on hover; clicking
 * one opens a popover with the source text and an editable translation. Save
 * writes through the standard string-translation pipeline so the next page
 * load (and other visitors) see the new value.
 *
 * This is a "click to translate" overlay — the live equivalent of
 * TranslatePress / Weglot's inline editor. It operates on the string-only
 * translation path (post_content strings), so no shadow post is involved.
 */
class VisualEditor {

	public static function init() {
		$self = new self();
		add_action( 'wp_enqueue_scripts', [ $self, 'enqueue' ] );
		add_action( 'wp_footer', [ $self, 'render_toggle' ], 99 );
	}

	public function enqueue() {
		if ( ! $this->should_load() ) {
			return;
		}
		$url  = GTRANS_ASSETS_URI;
		$ver  = GTRANS_VERSION;
		wp_enqueue_style(
			'gemtranslate-visual-editor',
			$url . 'visual-editor.css',
			[],
			$ver
		);
		wp_enqueue_script(
			'gemtranslate-visual-editor',
			$url . 'visual-editor.js',
			[],
			$ver,
			true
		);
		wp_localize_script(
			'gemtranslate-visual-editor',
			'gtransVisualEditor',
			[
				'rest_url'     => esc_url_raw( rest_url( GTRANS_REST_NAMESPACE . '/visual-editor/save' ) ),
				'nonce'        => wp_create_nonce( 'wp_rest' ),
				'post_id'      => get_the_ID() ?: 0,
				'lang'         => Context::current(),
				'is_default'   => Context::is_default(),
				'strings'      => [
					'toggle_on'        => __( 'Translate this page', 'gemtranslate' ),
					'toggle_off'       => __( 'Stop editing', 'gemtranslate' ),
					'source_label'     => __( 'Source', 'gemtranslate' ),
					'translation_label' => __( 'Translation', 'gemtranslate' ),
					'save'             => __( 'Save', 'gemtranslate' ),
					'cancel'           => __( 'Cancel', 'gemtranslate' ),
					'saving'           => __( 'Saving…', 'gemtranslate' ),
					'saved'            => __( 'Saved. Reloading…', 'gemtranslate' ),
					'default_lang_hint' => __( 'Switch to a non-default language to translate.', 'gemtranslate' ),
				],
			]
		);
	}

	public function render_toggle() {
		if ( ! $this->should_load() ) {
			return;
		}
		echo '<button id="gtrans-ve-toggle" type="button" aria-label="' .
			esc_attr__( 'Translate this page', 'gemtranslate' ) . '"></button>';
	}

	private function should_load() {
		if ( is_admin() || is_feed() ) {
			return false;
		}
		if ( ! is_singular() ) {
			return false; // editor needs a canonical post context to key translations.
		}
		if ( ! current_user_can( 'gtrans_translate_content' ) && ! current_user_can( 'manage_options' ) ) {
			return false;
		}
		return true;
	}
}

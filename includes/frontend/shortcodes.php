<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;
use GemTranslate\Translation\StringTranslator;

/**
 * Content shortcodes beyond the generic [gemtranslate_language_switcher],
 * modelled on WPML's shortcode set. Each has a matching PHP action for theme
 * templates.
 *
 * [gemtranslate_language_selector_widget]      action: gemtranslate_add_language_selector
 *   Drop-down switcher. No attributes; follows "Language switcher" settings.
 *
 * [gemtranslate_language_selector_footer]      action: gemtranslate_footer_language_selector
 *   Horizontal switcher. No attributes; follows "Footer switcher" settings and
 *   works even when the "Show in footer" option is off.
 *
 * [gemtranslate_language_form_field]           action: gemtranslate_add_language_form_field
 *   Hidden `lang` input for a custom search form. A search that arrives with
 *   `?lang=xx` for another active language is redirected to that language's
 *   prefixed URL so the results come back in the right language.
 *
 * [gemtranslate_string context="domain" name="name"]Text[/gemtranslate_string]
 *   Registers the enclosed text as a translatable string (domain = context,
 *   name = name) and prints the saved translation for the current language,
 *   falling back to the source text. Also available as [gemtranslate-string].
 *   Strings register when a page that shows them is visited.
 */
class Shortcodes {

	const STRING_DOMAIN = 'gemtranslate-shortcode';

	public static function init() {
		$self = new self();

		add_shortcode( 'gemtranslate_language_selector_widget', [ $self, 'render_widget' ] );
		add_shortcode( 'gemtranslate_language_selector_footer', [ $self, 'render_footer' ] );
		add_shortcode( 'gemtranslate_language_form_field', [ $self, 'render_form_field' ] );
		add_shortcode( 'gemtranslate_string', [ $self, 'render_string' ] );
		add_shortcode( 'gemtranslate-string', [ $self, 'render_string' ] );

		add_action( 'gemtranslate_add_language_selector', [ $self, 'echo_widget' ] );
		add_action( 'gemtranslate_footer_language_selector', [ $self, 'echo_footer' ] );
		add_action( 'gemtranslate_add_language_form_field', [ $self, 'echo_form_field' ] );

		add_action( 'wp_footer', [ $self, 'maybe_render_footer' ] );
		add_action( 'template_redirect', [ $self, 'redirect_search_language' ], 1 );
	}

	public function render_widget() {
		return ( new LanguageSwitcher() )->render_shortcode( [ 'type' => 'widget' ] );
	}

	public function render_footer() {
		$html = ( new LanguageSwitcher() )->render_shortcode( [ 'type' => 'footer' ] );
		if ( '' === $html ) {
			return '';
		}
		return '<div class="gtrans-switcher-footer">' . $html . '</div>';
	}

	public function render_form_field() {
		$lang = Context::current();
		if ( ! $lang ) {
			return '';
		}
		return '<input type="hidden" name="lang" value="' . esc_attr( $lang ) . '" />';
	}

	public function echo_widget() {
		echo $this->render_widget(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	public function echo_footer() {
		echo $this->render_footer(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	public function echo_form_field() {
		echo $this->render_form_field(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * "Show language switcher in footer" setting.
	 */
	public function maybe_render_footer() {
		if ( is_admin() || empty( $GLOBALS['gtrans_settings']->footer_switcher_enabled ) ) {
			return;
		}
		$this->echo_footer();
	}

	public function render_string( $atts, $content = '' ) {
		$atts   = shortcode_atts(
			[
				'context' => self::STRING_DOMAIN,
				'name'    => '',
			],
			$atts,
			'gemtranslate_string'
		);
		$source = trim( (string) $content );
		if ( '' === $source ) {
			return '';
		}

		$domain = sanitize_text_field( $atts['context'] ) ?: self::STRING_DOMAIN;
		$name   = sanitize_text_field( $atts['name'] );

		$string_id = StringTranslator::register_string( $source, $domain, $name );

		if ( ! Context::is_default() && $string_id ) {
			global $wpdb;
			$value = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT value FROM ' . Helper::table( 'string_translations' ) . " WHERE string_id = %d AND language_code = %s AND status != 'draft' AND value <> ''",
					$string_id,
					Context::current()
				)
			);
			if ( null !== $value && '' !== $value ) {
				$source = $value;
			}
		}

		return wp_kses_post( $source );
	}

	/**
	 * Send `?s=...&lang=xx` to the language-prefixed search URL.
	 */
	public function redirect_search_language() {
		if ( ! is_search() || empty( $_GET['lang'] ) ) {
			return;
		}
		$lang = sanitize_key( wp_unslash( $_GET['lang'] ) );
		if ( $lang === Context::current() || ! isset( Context::active_languages()[ $lang ] ) ) {
			return;
		}

		$query = [];
		parse_str( (string) ( $_SERVER['QUERY_STRING'] ?? '' ), $query );
		unset( $query['lang'] );

		$home = untrailingslashit( set_url_scheme( get_option( 'home' ) ) );
		$base = $lang === Context::default_code() ? $home . '/' : $home . '/' . $lang . '/';
		wp_safe_redirect( add_query_arg( rawurlencode_deep( $query ), $base ), 302 );
		exit;
	}
}

<?php
namespace GemTranslate\SEO;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;
use GemTranslate\Routing\UrlRewriter;
use GemTranslate\Translation\TranslationLoader;

/**
 * Fixes three things WordPress gets wrong on a translated page:
 *   1. <html lang="…"> — always matches current language.
 *   2. <title> — uses the translated post title, not the source one.
 *   3. og:locale (+ alternates) — social share cards reflect the language.
 */
class DocumentLocale {

	public static function init() {
		$self = new self();
		add_filter( 'language_attributes',   [ $self, 'filter_language_attributes' ], 10, 2 );
		add_filter( 'pre_get_document_title', [ $self, 'filter_document_title' ] );
		add_action( 'wp_head', [ $self, 'render_og_locale' ], 3 );
	}

	/**
	 * Swap `lang="en-US"` for the current language's locale (e.g. `bn` or `bn-BD`).
	 * Also sets `dir="rtl"` for RTL languages.
	 */
	public function filter_language_attributes( $output, $doctype = 'html' ) {
		if ( is_admin() ) {
			return $output;
		}
		$lang = Context::current();
		if ( ! $lang || Context::is_default() ) {
			return $output;
		}
		$row    = Context::active_languages()[ $lang ] ?? null;
		$locale = str_replace( '_', '-', $row['locale'] ?? $lang );

		// Drop any existing lang="…" / dir="…" tokens WP already emitted.
		// Match with OR without a leading whitespace so the very first token
		// in the attribute string gets stripped too.
		$output = preg_replace( '/(?:^|\s)(?:lang|dir)="[^"]*"/', '', $output );
		$output = trim( $output );
		$prefix = '' === $output ? '' : $output . ' ';
		$attrs  = $prefix . 'lang="' . esc_attr( $locale ) . '"';
		if ( ! empty( $row['is_rtl'] ) ) {
			$attrs .= ' dir="rtl"';
		}
		return $attrs;
	}

	/**
	 * Return the translated title for the queried singular post, so WordPress's
	 * title generator uses it. WP still wraps it with the separator + site name.
	 */
	public function filter_document_title( $pre ) {
		if ( null !== $pre && '' !== $pre ) {
			return $pre;
		}
		if ( Context::is_default() || ! is_singular() ) {
			return $pre;
		}
		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return $pre;
		}
		$row = TranslationLoader::get_for_post( $post_id );
		if ( ! $row || empty( $row['title'] ) ) {
			return $pre;
		}
		// Reproduce WP's "Title | Site Name" formatting.
		$sep  = apply_filters( 'document_title_separator', '-' );
		$site = get_bloginfo( 'name', 'display' );
		return $site ? $row['title'] . " $sep " . $site : $row['title'];
	}

	/**
	 * Emit <meta property="og:locale"> for the current language plus
	 * og:locale:alternate for every other active language. Lets Facebook,
	 * LinkedIn, and X render the right-language share preview.
	 */
	public function render_og_locale() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}
		$languages = Context::active_languages();
		if ( count( $languages ) <= 1 ) {
			return;
		}
		$current = Context::current();
		$current_locale = $this->og_locale( $languages[ $current ] ?? null, $current );
		if ( $current_locale ) {
			printf( '<meta property="og:locale" content="%s" />' . "\n", esc_attr( $current_locale ) );
		}
		foreach ( $languages as $code => $row ) {
			if ( $code === $current ) {
				continue;
			}
			$alt = $this->og_locale( $row, $code );
			if ( $alt ) {
				printf( '<meta property="og:locale:alternate" content="%s" />' . "\n", esc_attr( $alt ) );
			}
		}
	}

	private function og_locale( $row, $code ) {
		if ( ! empty( $row['locale'] ) ) {
			// og:locale wants the underscore form (en_US), not hyphen.
			return $row['locale'];
		}
		return $code;
	}
}

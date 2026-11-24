<?php
namespace GemTranslate\SEO;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Routing\UrlRewriter;

/**
 * Emits <link rel="alternate" hreflang> tags + x-default in wp_head.
 */
class HreflangOutput {

	public static function init() {
		$self = new self();
		add_action( 'wp_head', [ $self, 'render' ], 2 );
	}

	public function render() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		$languages = Context::active_languages();
		if ( count( $languages ) <= 1 ) {
			return;
		}

		$default  = Context::default_code();
		$rewriter = new UrlRewriter();
		$tags     = [];

		foreach ( $languages as $code => $lang ) {
			$url     = $rewriter->current_url_for_language( $code );
			$hreflang = $this->build_hreflang( $code, $lang );
			$tags[]  = sprintf(
				'<link rel="alternate" hreflang="%s" href="%s" />',
				esc_attr( $hreflang ),
				esc_url( $url )
			);
		}

		// x-default → default language URL.
		$tags[] = sprintf(
			'<link rel="alternate" hreflang="x-default" href="%s" />',
			esc_url( $rewriter->current_url_for_language( $default ) )
		);

		echo "\n" . wp_kses(
			implode( "\n", $tags ),
			[
				'link' => [
					'rel'      => true,
					'hreflang' => true,
					'href'     => true,
				],
			]
		) . "\n";
	}

	private function build_hreflang( $code, $lang ) {
		// Prefer locale-based hreflang (e.g., "pt-BR") over short code when available.
		$locale = isset( $lang['locale'] ) ? str_replace( '_', '-', $lang['locale'] ) : $code;
		return $locale;
	}
}

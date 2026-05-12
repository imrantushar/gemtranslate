<?php
namespace Zentranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Routing\UrlRewriter;

/**
 * Renders a list of active languages as switch links.
 *
 * Shortcode: [zentranslate_language_switcher]
 *   display="dropdown|inline" (default: inline)
 *   show_flag="1|0"           (default: 1)
 *   show_name="1|0"           (default: 1)
 *   show_native="1|0"         (default: 0)
 */
class LanguageSwitcher {

	public static function init() {
		$self = new self();
		add_shortcode( 'zentranslate_language_switcher', [ $self, 'render_shortcode' ] );
	}

	public function render_shortcode( $atts ) {
		$atts = shortcode_atts(
			[
				'display'     => 'inline',
				'show_flag'   => '1',
				'show_name'   => '1',
				'show_native' => '0',
			],
			$atts,
			'zentranslate_language_switcher'
		);

		$languages = Context::active_languages();
		if ( empty( $languages ) ) {
			return '';
		}

		$current  = Context::current();
		$rewriter = new UrlRewriter();

		$items = [];
		foreach ( $languages as $row ) {
			$is_current = $row['code'] === $current;
			$url        = $rewriter->current_url_for_language( $row['code'] );
			$label      = $this->build_label( $row, $atts );

			$items[] = sprintf(
				'<li class="ztrans-switcher-item%s"><a href="%s" hreflang="%s" lang="%s"%s>%s</a></li>',
				$is_current ? ' is-current' : '',
				esc_url( $url ),
				esc_attr( $row['code'] ),
				esc_attr( str_replace( '_', '-', $row['locale'] ) ),
				$is_current ? ' aria-current="true"' : '',
				$label
			);
		}

		$class = 'ztrans-switcher ztrans-switcher--' . sanitize_html_class( $atts['display'] );
		return '<ul class="' . esc_attr( $class ) . '">' . implode( '', $items ) . '</ul>';
	}

	private function build_label( $row, $atts ) {
		$parts = [];

		if ( '1' === (string) $atts['show_flag'] && ! empty( $row['flag'] ) ) {
			$parts[] = sprintf(
				'<span class="ztrans-switcher-flag" aria-hidden="true">%s</span>',
				esc_html( $this->flag_emoji( $row['flag'] ) )
			);
		}
		if ( '1' === (string) $atts['show_name'] ) {
			$parts[] = '<span class="ztrans-switcher-name">' . esc_html( $row['name'] ) . '</span>';
		}
		if ( '1' === (string) $atts['show_native'] && '1' !== (string) $atts['show_name'] ) {
			$parts[] = '<span class="ztrans-switcher-native">' . esc_html( $row['native_name'] ) . '</span>';
		} elseif ( '1' === (string) $atts['show_native'] ) {
			$parts[] = '<span class="ztrans-switcher-native">(' . esc_html( $row['native_name'] ) . ')</span>';
		}

		return implode( ' ', $parts );
	}

	/**
	 * Convert a country/language code to a flag emoji when possible.
	 * Falls back to the raw code for unknown values.
	 */
	private function flag_emoji( $code ) {
		// Treat hyphenated codes ("pt-br") as region-bearing.
		$code = strtolower( $code );
		if ( false !== strpos( $code, '-' ) ) {
			$region = strtoupper( substr( strrchr( $code, '-' ), 1 ) );
		} else {
			$lang_to_region = [
				'en' => 'GB', 'es' => 'ES', 'fr' => 'FR', 'de' => 'DE', 'it' => 'IT',
				'pt' => 'PT', 'ru' => 'RU', 'ja' => 'JP', 'zh' => 'CN', 'ar' => 'SA',
				'he' => 'IL', 'hi' => 'IN', 'bn' => 'BD', 'ko' => 'KR', 'tr' => 'TR',
				'nl' => 'NL', 'pl' => 'PL',
			];
			$region = $lang_to_region[ $code ] ?? strtoupper( $code );
		}
		if ( strlen( $region ) !== 2 ) {
			return strtoupper( $code );
		}
		$first  = mb_chr( 0x1F1E6 + ord( $region[0] ) - ord( 'A' ) );
		$second = mb_chr( 0x1F1E6 + ord( $region[1] ) - ord( 'A' ) );
		return $first . $second;
	}
}

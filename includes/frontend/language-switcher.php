<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Routing\UrlRewriter;

/**
 * Renders a list of active languages as switch links.
 *
 * Shortcode: [gemtranslate_language_switcher]
 *   display="dropdown|inline" (default: inline)
 *   show_flag="1|0"           (default: 1)
 *   show_name="1|0"           (default: 1)
 *   show_native="1|0"         (default: 0)
 */
class LanguageSwitcher {

	public static function init() {
		$self = new self();
		add_shortcode( 'gemtranslate_language_switcher', [ $self, 'render_shortcode' ] );
	}

	public function render_shortcode( $atts ) {
		$s = $this->saved_settings();

		$atts = shortcode_atts(
			[
				'display'       => $s['switcher_display'],
				'show_flag'     => $s['switcher_show_flag'] ? '1' : '0',
				'show_name'     => $s['switcher_show_name'] ? '1' : '0',
				'show_native'   => $s['switcher_show_native'] ? '1' : '0',
				'show_code'     => $s['switcher_show_code'] ? '1' : '0',
				'hide_current'  => $s['switcher_hide_current'] ? '1' : '0',
			],
			$atts,
			'gemtranslate_language_switcher'
		);

		$languages = Context::active_languages();
		if ( empty( $languages ) ) {
			return '';
		}

		// Respect "show even when only one language active" setting.
		if ( count( $languages ) <= 1 && ! $s['switcher_show_if_single'] ) {
			return '';
		}

		$current  = Context::current();
		$rewriter = new UrlRewriter();

		$items = [];
		foreach ( $languages as $row ) {
			$is_current = $row['code'] === $current;

			// Optionally hide the currently active language from the list.
			if ( $is_current && '1' === (string) $atts['hide_current'] ) {
				continue;
			}

			$url   = $rewriter->current_url_for_language( $row['code'] );
			$label = $this->build_label( $row, $atts );

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

		if ( empty( $items ) ) {
			return '';
		}

		$class = 'ztrans-switcher ztrans-switcher--' . sanitize_html_class( $atts['display'] );

		if ( 'dropdown' === $atts['display'] ) {
			return $this->render_dropdown( $items, $class );
		}
		return '<ul class="' . esc_attr( $class ) . '">' . implode( '', $items ) . '</ul>';
	}

	private function render_dropdown( $items, $class ) {
		$summary = '<summary class="ztrans-switcher-toggle">' . esc_html__( 'Language', 'gemtranslate' ) . '</summary>';
		return '<details class="' . esc_attr( $class ) . '">' . $summary . '<ul class="ztrans-switcher-dropdown-list">' . implode( '', $items ) . '</ul></details>';
	}

	/**
	 * Read saved switcher settings from the global settings object.
	 * Falls back to the same defaults that Settings::merged() uses so the
	 * switcher works even before the settings API is called.
	 */
	private function saved_settings() {
		$g = $GLOBALS['gtrans_settings'] ?? null;
		return [
			'switcher_display'        => isset( $g->switcher_display ) ? (string) $g->switcher_display : 'inline',
			'switcher_show_flag'      => isset( $g->switcher_show_flag ) ? (bool) $g->switcher_show_flag : true,
			'switcher_show_name'      => isset( $g->switcher_show_name ) ? (bool) $g->switcher_show_name : true,
			'switcher_show_native'    => isset( $g->switcher_show_native ) ? (bool) $g->switcher_show_native : false,
			'switcher_show_code'      => isset( $g->switcher_show_code ) ? (bool) $g->switcher_show_code : false,
			'switcher_hide_current'   => isset( $g->switcher_hide_current ) ? (bool) $g->switcher_hide_current : false,
			'switcher_show_if_single' => isset( $g->switcher_show_if_single ) ? (bool) $g->switcher_show_if_single : false,
		];
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
		if ( '1' === (string) ( $atts['show_code'] ?? '0' ) ) {
			$parts[] = '<span class="ztrans-switcher-code">(' . esc_html( $row['code'] ) . ')</span>';
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

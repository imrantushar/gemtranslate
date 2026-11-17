<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;
use GemTranslate\Routing\UrlRewriter;
use GemTranslate\Translation\TranslationLoader;

/**
 * Renders a list of active languages as switch links.
 *
 * Shortcode: [gemtranslate_language_switcher]
 *   type="custom|footer|widget|post_translations"  (default: custom)
 *       custom            -> "Language switcher" settings
 *       footer            -> "Footer switcher" settings
 *       widget            -> built-in defaults (dropdown, flag + name)
 *       post_translations -> "Language switcher" settings, listing only the
 *                            languages the current post is translated into
 *   flags | display_flags                        1|0  show the flag
 *   native | display_names_in_native_lang        1|0  show the native name
 *   translated | display_names_in_current_lang   1|0  show the language name
 *   link_current | display_link_for_current_lang 1|0  link the current language
 *   template                                     inline|dropdown (overrides display)
 *
 * Also accepted: display, show_flag, show_name, show_native, show_code, hide_current.
 * Any attribute passed explicitly beats the settings the type selects.
 */
class LanguageSwitcher {

	const TYPES = [ 'custom', 'footer', 'widget', 'post_translations' ];

	public static function init() {
		$self = new self();
		add_shortcode( 'gemtranslate_language_switcher', [ $self, 'render_shortcode' ] );
	}

	public function render_shortcode( $atts ) {
		$atts = is_array( $atts ) ? $atts : [];

		$type = isset( $atts['type'] ) ? sanitize_key( $atts['type'] ) : 'custom';
		if ( ! in_array( $type, self::TYPES, true ) ) {
			$type = 'custom';
		}

		$s = $this->saved_settings( 'footer' === $type ? 'footer_switcher' : 'switcher' );
		if ( 'widget' === $type ) {
			$s = array_merge(
				$s,
				[
					'display'      => 'dropdown',
					'show_flag'    => true,
					'show_name'    => true,
					'show_native'  => false,
					'show_code'    => false,
					'hide_current' => false,
				]
			);
		}

		$atts = shortcode_atts(
			[
				'type'                          => $type,
				'display'                       => $s['display'],
				'show_flag'                     => $s['show_flag'] ? '1' : '0',
				'show_name'                     => $s['show_name'] ? '1' : '0',
				'show_native'                   => $s['show_native'] ? '1' : '0',
				'show_code'                     => $s['show_code'] ? '1' : '0',
				'hide_current'                  => $s['hide_current'] ? '1' : '0',
				'link_current'                  => '1',
				// WPML-style names and their long aliases.
				'flags'                         => null,
				'display_flags'                 => null,
				'native'                        => null,
				'display_names_in_native_lang'  => null,
				'translated'                    => null,
				'display_names_in_current_lang' => null,
				'display_link_for_current_lang' => null,
				'template'                      => null,
			],
			$atts,
			'gemtranslate_language_switcher'
		);

		$aliases = [
			'show_flag'    => [ 'flags', 'display_flags' ],
			'show_native'  => [ 'native', 'display_names_in_native_lang' ],
			'show_name'    => [ 'translated', 'display_names_in_current_lang' ],
			'link_current' => [ 'display_link_for_current_lang' ],
		];
		foreach ( $aliases as $key => $names ) {
			foreach ( $names as $name ) {
				if ( null !== $atts[ $name ] && '' !== $atts[ $name ] ) {
					$atts[ $key ] = (string) $atts[ $name ];
				}
			}
		}
		if ( in_array( $atts['template'], [ 'inline', 'dropdown' ], true ) ) {
			$atts['display'] = $atts['template'];
		}
		$atts['display'] = in_array( $atts['display'], [ 'inline', 'dropdown' ], true ) ? $atts['display'] : 'inline';

		$languages = Context::active_languages();
		if ( empty( $languages ) ) {
			return '';
		}

		// Respect "show even when only one language active" setting.
		if ( count( $languages ) <= 1 && ! $s['show_if_single'] ) {
			return '';
		}

		if ( 'post_translations' === $type ) {
			$allowed = $this->translated_language_codes();
			if ( null !== $allowed ) {
				$languages = array_intersect_key( $languages, array_flip( $allowed ) );
			}
		}

		$current      = Context::current();
		$default_code = Context::default_code();
		$rewriter     = new UrlRewriter();
		$link_curr    = '0' !== (string) $atts['link_current'];

		$items = [];
		foreach ( $languages as $row ) {
			$is_current = $row['code'] === $current;

			// Honour "Show switcher for default language".
			if ( ! $s['show_for_default'] && $row['code'] === $default_code ) {
				continue;
			}

			// Optionally hide the currently active language from the list.
			if ( $is_current && '1' === (string) $atts['hide_current'] ) {
				continue;
			}

			$label = $this->build_label( $row, $atts );

			if ( $is_current && ! $link_curr ) {
				$items[] = sprintf(
					'<li class="gtrans-switcher-item is-current"><span lang="%s" aria-current="true">%s</span></li>',
					esc_attr( str_replace( '_', '-', $row['locale'] ) ),
					$label
				);
				continue;
			}

			$items[] = sprintf(
				'<li class="gtrans-switcher-item%s"><a href="%s" hreflang="%s" lang="%s"%s>%s</a></li>',
				$is_current ? ' is-current' : '',
				esc_url( $rewriter->switcher_url_for_language( $row['code'] ) ),
				esc_attr( $row['code'] ),
				esc_attr( str_replace( '_', '-', $row['locale'] ) ),
				$is_current ? ' aria-current="true"' : '',
				$label
			);
		}

		if ( empty( $items ) ) {
			return '';
		}

		$class = 'gtrans-switcher gtrans-switcher--' . sanitize_html_class( $atts['display'] );

		if ( 'dropdown' === $atts['display'] ) {
			return $this->render_dropdown( $items, $class );
		}
		return '<ul class="' . esc_attr( $class ) . '">' . implode( '', $items ) . '</ul>';
	}

	/**
	 * Language codes the current singular post exists in: its source language
	 * plus every saved, non-draft translation. Null means "not a post", so the
	 * caller shows every active language.
	 *
	 * @return string[]|null
	 */
	private function translated_language_codes() {
		if ( ! is_singular() ) {
			return null;
		}
		$post_id = (int) get_queried_object_id();
		$group   = $post_id ? TranslationLoader::group_id_for_post( $post_id ) : 0;
		$source  = (string) get_post_meta( $post_id, '_gtrans_source_lang', true );
		$codes   = [ $source ?: Context::default_code() ];

		if ( $group ) {
			global $wpdb;
			$rows  = $wpdb->get_col(
				$wpdb->prepare(
					'SELECT DISTINCT language_code FROM ' . Helper::table( 'post_translations' ) . " WHERE group_id = %d AND status <> 'draft'",
					$group
				)
			);
			$codes = array_merge( $codes, (array) $rows );
		}
		return array_values( array_unique( $codes ) );
	}

	private function render_dropdown( $items, $class ) {
		$summary = '<summary class="gtrans-switcher-toggle">' . esc_html__( 'Language', 'gemtranslate' ) . '</summary>';
		return '<details class="' . esc_attr( $class ) . '">' . $summary . '<ul class="gtrans-switcher-dropdown-list">' . implode( '', $items ) . '</ul></details>';
	}

	/**
	 * Read saved switcher settings from the global settings object. $prefix is
	 * "switcher" (Language switcher tab) or "footer_switcher" (Footer tab).
	 * Falls back to the same defaults Settings::merged() uses so the switcher
	 * works even before the settings API is called.
	 */
	private function saved_settings( $prefix = 'switcher' ) {
		$g   = $GLOBALS['gtrans_settings'] ?? null;
		$get = function ( $key, $default ) use ( $g, $prefix ) {
			$name = $prefix . '_' . $key;
			return isset( $g->$name ) ? $g->$name : $default;
		};
		return [
			'display'         => (string) $get( 'display', 'inline' ),
			'show_flag'       => (bool) $get( 'show_flag', true ),
			'show_name'       => (bool) $get( 'show_name', true ),
			'show_native'     => (bool) $get( 'show_native', false ),
			'show_code'       => (bool) $get( 'show_code', false ),
			'hide_current'    => (bool) $get( 'hide_current', false ),
			// These two are shared by every switcher type.
			'show_if_single'  => isset( $g->switcher_show_if_single ) ? (bool) $g->switcher_show_if_single : false,
			'show_for_default' => isset( $g->show_switcher_for_default ) ? (bool) $g->show_switcher_for_default : true,
		];
	}

	private function build_label( $row, $atts ) {
		$parts = [];

		if ( '1' === (string) $atts['show_flag'] && ! empty( $row['flag'] ) ) {
			$parts[] = sprintf(
				'<span class="gtrans-switcher-flag" aria-hidden="true">%s</span>',
				esc_html( $this->flag_emoji( $row['flag'] ) )
			);
		}
		if ( '1' === (string) $atts['show_name'] ) {
			$parts[] = '<span class="gtrans-switcher-name">' . esc_html( $row['name'] ) . '</span>';
		}
		if ( '1' === (string) $atts['show_native'] && '1' !== (string) $atts['show_name'] ) {
			$parts[] = '<span class="gtrans-switcher-native">' . esc_html( $row['native_name'] ) . '</span>';
		} elseif ( '1' === (string) $atts['show_native'] ) {
			$parts[] = '<span class="gtrans-switcher-native">(' . esc_html( $row['native_name'] ) . ')</span>';
		}
		if ( '1' === (string) ( $atts['show_code'] ?? '0' ) ) {
			$parts[] = '<span class="gtrans-switcher-code">(' . esc_html( $row['code'] ) . ')</span>';
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

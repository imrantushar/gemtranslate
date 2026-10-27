<?php
namespace GemTranslate\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Translation\StringTranslator;

/**
 * Strings-only translation for pages built with Elementor.
 *
 * Elementor stores page content as a JSON tree in `_elementor_data`
 * postmeta — not in `post_content` — so the Gutenberg block pipeline
 * misses it. Here we:
 *
 *   1. On source-page save, walk the JSON and register every
 *      translatable string in GemTranslate's `strings` table.
 *   2. On frontend render, when the current language is non-default,
 *      filter `_elementor_data` through the same walker and swap each
 *      source string for its translation (where one exists).
 *
 * Supports Elementor's core widgets (heading, text, button, image
 * caption, icon-list, tabs, accordion, testimonial, call-to-action,
 * form labels, price table) and any third-party widget whose settings
 * use the standard text-field keys. Custom widgets using exotic keys
 * can be covered by filtering `gtrans_elementor_text_keys`.
 */
class Elementor {

	/**
	 * Setting keys we treat as translatable text. Covers Elementor core
	 * widgets plus common patterns in third-party widgets.
	 */
	const TEXT_KEYS = [
		'title', 'editor', 'text', 'html', 'description', 'caption',
		'heading', 'sub_heading', 'sub_title', 'subtitle', 'label',
		'placeholder', 'button_text', 'link_text', 'cta_text',
		'tab_title', 'tab_content', 'inner_text',
		'testimonial_content', 'testimonial_name', 'testimonial_job',
		'item_text', 'title_text', 'description_text',
		'before_text', 'after_text', 'hover_text',
		'form_name', 'success_message', 'error_message',
		'alert_title', 'alert_description',
		'blockquote_content', 'author',
	];

	/**
	 * Keys whose value is an array of objects to recurse into.
	 * (Elementor's "repeater" fields.)
	 */
	const REPEATER_KEYS = [
		'tabs', 'items', 'icon_list', 'social_icon_list', 'form_fields',
		'price_list', 'features_list', 'slides', 'testimonials',
	];

	public static function init() {
		if ( ! defined( 'ELEMENTOR_VERSION' ) ) {
			return;
		}
		$self = new self();
		add_action( 'save_post', [ $self, 'on_source_save' ], 20, 3 );
		add_filter( 'get_post_metadata', [ $self, 'filter_meta_on_read' ], 10, 4 );
	}

	/**
	 * When any post with Elementor data is saved, re-scan its JSON and
	 * register every text string into the GemTranslate string table so
	 * editors can translate them. Only runs on the SOURCE post (we skip
	 * shadow posts, which carry their own translated content).
	 */
	public function on_source_save( $post_id, $post, $update ) {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		if ( get_post_meta( $post_id, '_gtrans_translation_of', true ) ) {
			return; // shadow post — ignore.
		}
		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( empty( $raw ) ) {
			return;
		}
		$data = is_string( $raw ) ? json_decode( $raw, true ) : $raw;
		if ( ! is_array( $data ) ) {
			return;
		}
		$strings = [];
		self::collect_strings( $data, $strings );
		if ( empty( $strings ) ) {
			return;
		}
		$context = 'post:' . (int) $post_id;
		foreach ( array_unique( $strings ) as $source ) {
			StringTranslator::register_string( $source, 'gtrans:elementor', $context );
		}
	}

	/**
	 * Intercept reads of `_elementor_data` on the frontend; swap source
	 * strings for their translations before Elementor renders.
	 *
	 * We rely on get_post_metadata to let us short-circuit (returning
	 * non-null causes WP to skip its own read). We fetch the raw row
	 * ourselves, mutate it, and return the modified value.
	 */
	public function filter_meta_on_read( $value, $object_id, $meta_key, $single ) {
		if ( '_elementor_data' !== $meta_key || ! $single ) {
			return $value;
		}
		if ( Context::is_default() || is_admin() ) {
			return $value;
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return $value;
		}
		// Shadow post? Their JSON already carries translated text —
		// no runtime swap needed.
		if ( get_post_meta( $object_id, '_gtrans_translation_of', true ) ) {
			return $value;
		}

		// Guard against recursive reads inside this filter.
		static $busy = false;
		if ( $busy ) {
			return $value;
		}
		$busy = true;

		global $wpdb;
		$raw = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT meta_value FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = '_elementor_data' LIMIT 1",
				(int) $object_id
			)
		);
		$busy = false;

		if ( empty( $raw ) ) {
			return $value;
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			return $value;
		}
		$translator = new StringTranslator();
		$ctx        = 'post:' . (int) $object_id;
		self::translate_tree( $data, $translator, $ctx );
		// Elementor reads _elementor_data as a JSON string. The DB-stored
		// value isn't slash-escaped at read time, so don't wp_slash here —
		// doing so would corrupt the JSON that Elementor's json_decode sees.
		return [ wp_json_encode( $data ) ];
	}

	/**
	 * Recursively collect every translatable string value from an
	 * Elementor data tree (used by the scan pass).
	 */
	private static function collect_strings( $node, array &$out ) {
		if ( is_array( $node ) ) {
			// Element with widget settings?
			if ( isset( $node['settings'] ) && is_array( $node['settings'] ) ) {
				self::walk_settings( $node['settings'], $out, 'collect' );
			}
			// Nested elements (sections → columns → widgets, containers).
			if ( isset( $node['elements'] ) && is_array( $node['elements'] ) ) {
				foreach ( $node['elements'] as $child ) {
					self::collect_strings( $child, $out );
				}
			}
			// Flat array (top-level Elementor data).
			if ( ! isset( $node['settings'] ) && ! isset( $node['elements'] ) ) {
				foreach ( $node as $child ) {
					if ( is_array( $child ) ) {
						self::collect_strings( $child, $out );
					}
				}
			}
		}
	}

	/**
	 * Walk a settings object, extracting (collect mode) or swapping
	 * (translate mode) each known text key. Recurses into repeater
	 * arrays.
	 */
	private static function walk_settings( array &$settings, &$state, $mode, $translator = null, $ctx = '' ) {
		$text_keys = apply_filters( 'gtrans_elementor_text_keys', self::TEXT_KEYS );
		$repeaters = apply_filters( 'gtrans_elementor_repeater_keys', self::REPEATER_KEYS );

		foreach ( $settings as $key => &$value ) {
			if ( is_string( $value ) && in_array( $key, $text_keys, true ) ) {
				$trimmed = trim( $value );
				if ( '' === $trimmed ) {
					continue;
				}
				if ( 'collect' === $mode ) {
					$state[] = $value;
				} elseif ( 'translate' === $mode && $translator ) {
					$translated = $translator->filter_gettext( $value, $value, 'gtrans:elementor' );
					// filter_gettext only swaps when context matches; our
					// strings live under (domain=gtrans:elementor, context=post:ID).
					// Fall back to a direct lookup against the (ctx) key.
					if ( $translated === $value ) {
						$direct = self::direct_lookup( $value, $ctx );
						if ( '' !== $direct ) {
							$value = $direct;
						}
					} else {
						$value = $translated;
					}
				}
				continue;
			}
			if ( is_array( $value ) && in_array( $key, $repeaters, true ) ) {
				foreach ( $value as &$row ) {
					if ( is_array( $row ) ) {
						self::walk_settings( $row, $state, $mode, $translator, $ctx );
					}
				}
				unset( $row );
			}
		}
		unset( $value );
	}

	/**
	 * Walk a full Elementor tree in translate mode.
	 */
	private static function translate_tree( &$node, $translator, $ctx ) {
		if ( ! is_array( $node ) ) {
			return;
		}
		if ( isset( $node['settings'] ) && is_array( $node['settings'] ) ) {
			$state = null;
			self::walk_settings( $node['settings'], $state, 'translate', $translator, $ctx );
		}
		if ( isset( $node['elements'] ) && is_array( $node['elements'] ) ) {
			foreach ( $node['elements'] as &$child ) {
				self::translate_tree( $child, $translator, $ctx );
			}
			unset( $child );
		}
		if ( ! isset( $node['settings'] ) && ! isset( $node['elements'] ) ) {
			foreach ( $node as &$child ) {
				if ( is_array( $child ) ) {
					self::translate_tree( $child, $translator, $ctx );
				}
			}
			unset( $child );
		}
	}

	/**
	 * Lookup against (domain=gtrans:elementor, context=post:ID). Used
	 * when the generic gettext filter path misses — our strings aren't
	 * loaded into the StringTranslator runtime map (which is scoped to
	 * no-context lookups).
	 */
	private static function direct_lookup( $source, $ctx ) {
		static $cache = [];
		$cache_key = $ctx . "\x1f" . $source;
		if ( array_key_exists( $cache_key, $cache ) ) {
			return $cache[ $cache_key ];
		}
		global $wpdb;
		$st  = \GemTranslate\Helper::table( 'strings' );
		$stt = \GemTranslate\Helper::table( 'string_translations' );
		$val = (string) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT t.value FROM $stt AS t
				 INNER JOIN $st AS s ON s.string_id = t.string_id
				 WHERE s.domain = %s AND s.context = %s AND s.source = %s
				   AND t.language_code = %s AND t.status != 'draft'
				 LIMIT 1",
				'gtrans:elementor',
				$ctx,
				$source,
				Context::current()
			)
		);
		$cache[ $cache_key ] = $val;
		return $val;
	}
}

<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;

/**
 * Elementor support for block-wise translation.
 *
 * Elementor stores a page as JSON in the `_elementor_data` post meta: a tree of
 * sections/containers/columns/widgets, each with an `id`, `elType`,
 * `widgetType`, `settings` and child `elements`. We never touch structure, ids
 * or styling — only the text-bearing widget settings listed in
 * {@see self::translatable_settings()}.
 *
 * Translations reuse the same store as the Gutenberg "strings only" mode (keyed
 * by the tokenised source text), so a unit is addressed in the UI by
 * `{element_id}:{setting path}` but persisted by its source text. On the front
 * end the `_elementor_data` meta read is intercepted and the translated tree is
 * returned for the requested language.
 */
class ElementorTranslator {

	/** @var array<string,string> Memo of translated JSON keyed "{post_id}:{lang}". */
	private static $memo = [];

	public static function init() {
		add_filter( 'get_post_metadata', [ __CLASS__, 'filter_data_meta' ], 10, 4 );
	}

	/**
	 * Widget type => list of setting paths. A path segment of `*` walks every
	 * item of a repeater (e.g. `tabs.*.tab_title`).
	 *
	 * @return array<string,string[]>
	 */
	public static function translatable_settings() {
		$map = [
			'heading'          => [ 'title' ],
			'text-editor'      => [ 'editor' ],
			'button'           => [ 'text' ],
			'image'            => [ 'caption' ],
			'image-box'        => [ 'title_text', 'description_text' ],
			'icon-box'         => [ 'title_text', 'description_text' ],
			'icon-list'        => [ 'icon_list.*.text' ],
			'accordion'        => [ 'tabs.*.tab_title', 'tabs.*.tab_content' ],
			'toggle'           => [ 'tabs.*.tab_title', 'tabs.*.tab_content' ],
			'tabs'             => [ 'tabs.*.tab_title', 'tabs.*.tab_content' ],
			'testimonial'      => [ 'testimonial_content', 'testimonial_name', 'testimonial_job' ],
			'counter'          => [ 'title', 'prefix', 'suffix' ],
			'progress'         => [ 'title', 'inner_text' ],
			'alert'            => [ 'alert_title', 'alert_description' ],
			'star-rating'      => [ 'title' ],
			'blockquote'       => [ 'blockquote_content', 'author_name', 'tweet_button_label' ],
			'call-to-action'   => [ 'title', 'description', 'button', 'ribbon_title' ],
			'flip-box'         => [ 'title_text_a', 'description_text_a', 'title_text_b', 'description_text_b', 'button_text' ],
			'price-table'      => [ 'heading', 'sub_heading', 'button_text', 'footer_additional_info', 'features_list.*.item_text' ],
			'price-list'       => [ 'price_list.*.title', 'price_list.*.item_description' ],
			'form'             => [ 'button_text', 'form_fields.*.field_label', 'form_fields.*.placeholder' ],
			'animated-headline' => [ 'before_text', 'rotating_text', 'highlighted_text', 'after_text' ],
		];
		/**
		 * Filter the Elementor widget settings that are offered for translation.
		 *
		 * @param array<string,string[]> $map widgetType => setting paths.
		 */
		return (array) apply_filters( 'gtrans_elementor_translatable_settings', $map );
	}

	/**
	 * True when Elementor is loaded AND this post was built with it.
	 */
	public static function is_elementor_post( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 || ! self::is_active() ) {
			return false;
		}
		return 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true )
			&& '' !== (string) get_metadata_raw( 'post', $post_id, '_elementor_data', true );
	}

	public static function is_active() {
		return defined( 'ELEMENTOR_VERSION' ) || class_exists( '\Elementor\Plugin' );
	}

	/**
	 * Decode a post's raw `_elementor_data` into an array tree.
	 *
	 * @return array
	 */
	public static function get_tree( $post_id ) {
		$raw = get_metadata_raw( 'post', (int) $post_id, '_elementor_data', true );
		if ( is_array( $raw ) ) {
			return $raw;
		}
		$tree = json_decode( (string) $raw, true );
		return is_array( $tree ) ? $tree : [];
	}

	/**
	 * Flat list of translatable settings in the tree.
	 *
	 * @return array<array{id:string,element:string,widget:string,setting:string,value:string}>
	 */
	public static function extract( array $tree ) {
		$out = [];
		self::walk( $tree, function ( $element, $path, $value ) use ( &$out ) {
			$out[] = [
				'id'      => $element['id'] . ':' . $path,
				'element' => (string) $element['id'],
				'widget'  => (string) ( $element['widgetType'] ?? '' ),
				'setting' => $path,
				'value'   => $value,
			];
			return null;
		} );
		return $out;
	}

	/**
	 * Return $tree with every translatable setting that has an entry in $map
	 * (tokenised source => tokenised translation) rewritten.
	 */
	public static function apply( array $tree, array $map ) {
		if ( empty( $map ) ) {
			return $tree;
		}
		self::walk( $tree, function ( $element, $path, $value ) use ( $map ) {
			$parsed = TokenExtractor::extract( $value );
			$key    = $parsed['text'];
			if ( isset( $map[ $key ] ) && '' !== $map[ $key ] ) {
				return TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $map[ $key ] );
			}
			return null;
		} );
		return $tree;
	}

	/**
	 * Visit every translatable string setting. The callback receives
	 * ($element, $setting_path, $value) and may return a replacement string
	 * (written back into $tree) or null to leave it alone.
	 */
	private static function walk( array &$elements, callable $cb ) {
		$settings_map = self::translatable_settings();
		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( 'widget' === ( $element['elType'] ?? '' ) && ! empty( $element['id'] ) && isset( $element['settings'] ) && is_array( $element['settings'] ) ) {
				foreach ( $settings_map[ $element['widgetType'] ?? '' ] ?? [] as $setting ) {
					self::visit_path( $element['settings'], explode( '.', $setting ), '', $element, $cb );
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				self::walk( $element['elements'], $cb );
			}
		}
	}

	private static function visit_path( &$node, array $segments, $trail, $element, callable $cb ) {
		$seg = array_shift( $segments );
		if ( ! is_array( $node ) ) {
			return;
		}
		if ( '*' === $seg ) {
			foreach ( array_keys( $node ) as $i ) {
				$next = $trail . ( '' === $trail ? '' : '.' ) . $i;
				if ( $segments ) {
					self::visit_path( $node[ $i ], $segments, $next, $element, $cb );
				}
			}
			return;
		}
		if ( ! array_key_exists( $seg, $node ) ) {
			return;
		}
		$next = $trail . ( '' === $trail ? '' : '.' ) . $seg;
		if ( $segments ) {
			self::visit_path( $node[ $seg ], $segments, $next, $element, $cb );
			return;
		}
		if ( is_string( $node[ $seg ] ) && '' !== trim( $node[ $seg ] ) ) {
			$replacement = $cb( $element, $next, $node[ $seg ] );
			if ( null !== $replacement ) {
				$node[ $seg ] = $replacement;
			}
		}
	}

	/**
	 * Front-end hook: serve the translated tree whenever Elementor asks for
	 * `_elementor_data` on a translated request.
	 */
	public static function filter_data_meta( $check, $object_id, $meta_key, $single ) {
		if ( null !== $check || '_elementor_data' !== $meta_key || ! $single ) {
			return $check;
		}
		if ( Context::is_default() || is_admin() || isset( $_GET['elementor-preview'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return $check;
		}
		$object_id = (int) $object_id;
		$lang      = Context::current();
		$memo_key  = $object_id . ':' . $lang;
		if ( isset( self::$memo[ $memo_key ] ) ) {
			return false === self::$memo[ $memo_key ] ? $check : self::$memo[ $memo_key ];
		}

		self::$memo[ $memo_key ] = false;
		$row = TranslationLoader::get_for_post( $object_id );
		if ( ! $row || TranslationLoader::MODE_STRING_ONLY !== ( $row['translation_mode'] ?? '' ) ) {
			return $check;
		}
		$tree = self::get_tree( $object_id );
		$map  = TranslationLoader::load_string_translations_for_post( $object_id, $lang );
		if ( ! $tree || ! $map ) {
			return $check;
		}
		self::$memo[ $memo_key ] = wp_json_encode( self::apply( $tree, $map ) );
		return self::$memo[ $memo_key ];
	}

	public static function flush_memo() {
		self::$memo = [];
	}
}

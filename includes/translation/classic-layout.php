<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;

/**
 * Header / footer text of classic themes, which have no template parts:
 *
 *  - Widgets (`widget:{id}`): the title and text of every widget placed in a
 *    sidebar — Text, Custom HTML, Block and any widget with a `title`.
 *  - Customizer (`customizer:site`): site title, tagline and the theme's own
 *    text options (footer copyright, header button, …).
 *
 * Translations are stored exactly like {@see LayoutTranslator}'s (same domain,
 * context and tokenised source-text keys), so the admin screens, saving, country
 * variants and the page-cache purge all work unchanged. Here we only list the
 * sources and apply the saved map at render time.
 */
class ClassicLayout {

	const TYPE_WIDGET     = 'widget';
	const TYPE_CUSTOMIZER = 'customizer';
	const CUSTOMIZER_ID   = 'customizer:site';

	/** Widget instance fields that hold text. */
	const WIDGET_FIELDS = [ 'title', 'text', 'content' ];

	/** Theme-mod keys worth translating even when the value is a single word. */
	const MOD_KEY_PATTERN = '/(text|title|label|copyright|tagline|description|heading|content|message|button|caption|name|subtitle|address|slogan|credit|notice)/i';

	/** True while the admin reads sources: render-time translation must stay off. */
	private static $raw = false;

	public static function is_classic() {
		return ! function_exists( 'wp_is_block_theme' ) || ! wp_is_block_theme();
	}

	public static function init() {
		$self = new self();

		foreach ( [ 'widget_title', 'widget_text', 'widget_text_content', 'widget_custom_html_content' ] as $hook ) {
			add_filter( $hook, [ $self, 'translate_text' ], 20 );
		}
		add_filter( 'widget_block_content', [ $self, 'translate_blocks' ], 20 );

		add_filter( 'option_blogname', [ $self, 'translate_text' ], 20 );
		add_filter( 'option_blogdescription', [ $self, 'translate_text' ], 20 );
		add_action(
			'after_setup_theme',
			static function () use ( $self ) {
				add_filter( 'option_theme_mods_' . get_option( 'stylesheet' ), [ $self, 'translate_mods' ], 20 );
			}
		);
	}

	/* --------------------------------------------------------------------
	 * Admin: catalogue
	 * ------------------------------------------------------------------ */

	/**
	 * @return array<int,array{id:string,type:string,title:string,detail:string}>
	 */
	public static function items() {
		$items = [];

		global $wp_registered_sidebars;
		foreach ( (array) wp_get_sidebars_widgets() as $sidebar => $widget_ids ) {
			if ( 'wp_inactive_widgets' === $sidebar || ! is_array( $widget_ids ) ) {
				continue;
			}
			$area = $wp_registered_sidebars[ $sidebar ]['name'] ?? $sidebar;
			foreach ( $widget_ids as $widget_id ) {
				$items[] = [
					'id'     => self::TYPE_WIDGET . ':' . $widget_id,
					'type'   => self::TYPE_WIDGET,
					'title'  => self::widget_label( $widget_id ),
					'detail' => wp_strip_all_tags( (string) $area ),
				];
			}
		}

		$items[] = [
			'id'     => self::CUSTOMIZER_ID,
			'type'   => self::TYPE_CUSTOMIZER,
			'title'  => __( 'Site identity & theme options', 'gemtranslate' ),
			'detail' => '',
		];
		return $items;
	}

	/** Whether `$id` is one of ours. */
	public static function owns( $id ) {
		return self::CUSTOMIZER_ID === $id || 0 === strpos( (string) $id, self::TYPE_WIDGET . ':' );
	}

	/**
	 * Distinct translatable texts of a widget / the customizer, language-independent.
	 *
	 * @return array<int,array{source:string,label:string,tokens:array}>|null Null when unknown.
	 */
	public static function sources( $id ) {
		$fields = self::fields( $id );
		if ( null === $fields ) {
			return null;
		}

		$out  = [];
		$seen = [];
		$add  = static function ( $text, $label, array $tokens ) use ( &$out, &$seen ) {
			if ( '' === trim( preg_replace( '/\{\d+\}/', '', $text ) ) || isset( $seen[ $text ] ) ) {
				return;
			}
			$seen[ $text ] = true;
			$out[]         = [ 'source' => $text, 'label' => $label, 'tokens' => $tokens ];
		};

		foreach ( $fields as $field ) {
			if ( 'blocks' === $field['kind'] ) {
				foreach ( BlockParser::extract( $field['value'] ) as $f ) {
					if ( 'image' === $f['kind'] ) {
						continue;
					}
					$parsed = TokenExtractor::extract( (string) $f['value'] );
					$add( $parsed['text'], BlockUnits::block_label( $f['block'], $f['kind'], $f['attr'] ), (array) $parsed['tokens'] );
				}
				continue;
			}
			$parsed = TokenExtractor::extract( $field['value'] );
			$add( $parsed['text'], $field['label'], (array) $parsed['tokens'] );
		}
		return $out;
	}

	/**
	 * @return array<int,array{label:string,value:string,kind:string}>|null
	 */
	private static function fields( $id ) {
		self::$raw = true;
		try {
			return self::CUSTOMIZER_ID === $id ? self::customizer_fields() : self::widget_fields( (string) $id );
		} finally {
			self::$raw = false;
		}
	}

	private static function widget_fields( $id ) {
		if ( 0 !== strpos( $id, self::TYPE_WIDGET . ':' ) ) {
			return null;
		}
		$instance = self::widget_instance( substr( $id, strlen( self::TYPE_WIDGET ) + 1 ) );
		if ( null === $instance ) {
			return null;
		}
		list( $base, $data ) = $instance;

		$labels = [
			'title'   => __( 'Title', 'gemtranslate' ),
			'text'    => __( 'Text', 'gemtranslate' ),
			'content' => __( 'Content', 'gemtranslate' ),
		];
		$out = [];
		foreach ( self::WIDGET_FIELDS as $key ) {
			$value = $data[ $key ] ?? '';
			if ( ! is_string( $value ) || '' === trim( $value ) ) {
				continue;
			}
			$out[] = [
				'label' => $labels[ $key ],
				'value' => $value,
				'kind'  => ( 'block' === $base && 'content' === $key ) ? 'blocks' : 'text',
			];
		}
		return $out;
	}

	private static function customizer_fields() {
		$out = [];
		foreach ( [ 'blogname' => __( 'Site title', 'gemtranslate' ), 'blogdescription' => __( 'Tagline', 'gemtranslate' ) ] as $key => $label ) {
			$value = (string) get_option( $key, '' );
			if ( '' !== trim( $value ) ) {
				$out[] = [ 'label' => $label, 'value' => $value, 'kind' => 'text' ];
			}
		}
		foreach ( (array) get_theme_mods() as $key => $value ) {
			if ( self::is_text_mod( $key, $value ) ) {
				$out[] = [
					'label' => ucfirst( trim( str_replace( [ '_', '-' ], ' ', (string) $key ) ) ),
					'value' => $value,
					'kind'  => 'text',
				];
			}
		}
		return $out;
	}

	/** Text a visitor reads, as opposed to colours, URLs, ids and file names. */
	private static function is_text_mod( $key, $value ) {
		if ( ! is_string( $value ) || strlen( $value ) < 2 || strlen( $value ) > 1000 ) {
			return false;
		}
		if ( ! preg_match( '/\p{L}/u', $value ) || preg_match( '#^(https?:)?//|^[#]|^(rgb|hsl)a?\(|\.(png|jpe?g|gif|svg|webp)$#i', trim( $value ) ) ) {
			return false;
		}
		return false !== strpos( trim( $value ), ' ' ) || (bool) preg_match( self::MOD_KEY_PATTERN, (string) $key );
	}

	/** `text-3` → [ 'text', instance array ]; null when the widget has no stored instance. */
	private static function widget_instance( $widget_id ) {
		if ( ! preg_match( '/^(.+)-(\d+)$/', $widget_id, $m ) ) {
			return null;
		}
		$all = get_option( 'widget_' . $m[1] );
		return ( is_array( $all ) && isset( $all[ (int) $m[2] ] ) && is_array( $all[ (int) $m[2] ] ) )
			? [ $m[1], $all[ (int) $m[2] ] ]
			: null;
	}

	private static function widget_label( $widget_id ) {
		global $wp_registered_widgets;
		$name  = (string) ( $wp_registered_widgets[ $widget_id ]['name'] ?? $widget_id );
		$found = self::widget_instance( $widget_id );
		$title = $found ? trim( wp_strip_all_tags( (string) ( $found[1]['title'] ?? '' ) ) ) : '';
		return '' !== $title ? $title : $name;
	}

	/* --------------------------------------------------------------------
	 * Frontend: apply saved translations
	 * ------------------------------------------------------------------ */

	/** Source text => translation for the visitor's language, or [] when nothing applies. */
	private static function map() {
		if ( self::$raw || is_admin() || is_customize_preview() || Context::is_default() || EditorContext::is_render_target() ) {
			return [];
		}
		return LayoutTranslator::load_map( Context::current(), CountryContext::current() );
	}

	public function translate_text( $text ) {
		return is_string( $text ) ? self::translate_string( $text, self::map() ) : $text;
	}

	public function translate_blocks( $content ) {
		$map = self::map();
		if ( ! $map || ! is_string( $content ) ) {
			return $content;
		}
		$translations = [];
		foreach ( BlockParser::extract( $content ) as $f ) {
			if ( 'image' === $f['kind'] ) {
				continue;
			}
			$parsed = TokenExtractor::extract( (string) $f['value'] );
			if ( ! empty( $map[ $parsed['text'] ] ) ) {
				$translations[ $f['path'] ] = TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $map[ $parsed['text'] ] );
			}
		}
		return $translations ? BlockParser::apply( $content, $translations ) : $content;
	}

	public function translate_mods( $mods ) {
		$map = self::map();
		if ( ! $map || ! is_array( $mods ) ) {
			return $mods;
		}
		foreach ( $mods as $key => $value ) {
			if ( self::is_text_mod( $key, $value ) ) {
				$mods[ $key ] = self::translate_string( $value, $map );
			}
		}
		return $mods;
	}

	private static function translate_string( $text, array $map ) {
		if ( ! $map || '' === trim( $text ) ) {
			return $text;
		}
		$parsed = TokenExtractor::extract( $text );
		return ! empty( $map[ $parsed['text'] ] )
			? TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $map[ $parsed['text'] ] )
			: $text;
	}
}

<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Block-wise translation units for a post, for both Gutenberg and Elementor.
 *
 * A unit is one translatable text: a block's inner text or attribute
 * (Gutenberg, id = block path + attribute e.g. `2.0.innerHTML`, `1.attrs.alt`)
 * or one Elementor widget setting (id = `{element_id}:{setting}`). Title and
 * excerpt are included as the `title` / `excerpt` units.
 *
 * Units are *stored* the way the "strings only" mode stores them (keyed by the
 * tokenised source text, see {@see PostFieldTranslator}), so the existing render
 * path, history snapshots and the Simple/Advanced editors all stay in sync.
 * Identical source texts collapse into one unit with a `count`.
 */
class BlockUnits {

	const BUILDER_ELEMENTOR = 'elementor';
	const BUILDER_GUTENBERG = 'gutenberg';
	const BUILDER_CLASSIC   = 'classic';

	/**
	 * Which builder owns this post's body.
	 */
	public static function detect_builder( $post ) {
		$post_id = is_object( $post ) ? (int) $post->ID : (int) $post;
		if ( ElementorTranslator::is_elementor_post( $post_id ) ) {
			return self::BUILDER_ELEMENTOR;
		}
		$content = is_object( $post ) ? (string) $post->post_content : '';
		return BlockParser::is_block_content( $content ) ? self::BUILDER_GUTENBERG : self::BUILDER_CLASSIC;
	}

	/**
	 * @return array{builder:string,elementor_active:bool,units:array<int,array>}
	 */
	public static function enumerate( $post, $language ) {
		$builder = self::detect_builder( $post );
		$map     = TranslationLoader::load_string_translations_for_post( (int) $post->ID, strtolower( (string) $language ) );

		$units = [];
		$index = []; // tokenised text => position in $units
		$add   = function ( $id, $kind, $type, $label, $raw ) use ( &$units, &$index, $map ) {
			$parsed = TokenExtractor::extract( (string) $raw );
			$text   = $parsed['text'];
			// Nothing a translator can act on (markup/placeholders only).
			if ( '' === trim( preg_replace( '/\{\d+\}/', '', $text ) ) ) {
				return;
			}
			if ( isset( $index[ $text ] ) ) {
				$units[ $index[ $text ] ]['count']++;
				return;
			}
			$index[ $text ] = count( $units );
			$units[]        = [
				'id'          => $id,
				'kind'        => $kind,
				'type'        => $type,
				'label'       => $label,
				'source'      => $text,
				'translation' => $map[ $text ] ?? '',
				'tokens'      => self::stringify_tokens( $parsed['tokens'] ),
				'count'       => 1,
			];
		};

		$add( PostFieldTranslator::PATH_TITLE, 'plain', 'post:title', __( 'Title', 'gemtranslate' ), (string) $post->post_title );
		$add( PostFieldTranslator::PATH_EXCERPT, 'plain', 'post:excerpt', __( 'Excerpt', 'gemtranslate' ), (string) $post->post_excerpt );

		if ( self::BUILDER_ELEMENTOR === $builder ) {
			foreach ( ElementorTranslator::extract( ElementorTranslator::get_tree( $post->ID ) ) as $f ) {
				$is_image = ElementorTranslator::is_image_setting( $f['setting'] );
				$add(
					$f['id'],
					$is_image ? 'image' : 'setting',
					$f['widget'],
					$is_image ? ucwords( str_replace( [ '-', '_' ], ' ', $f['widget'] ) ) . ' · ' . __( 'image', 'gemtranslate' ) : self::elementor_label( $f['widget'], $f['setting'] ),
					$f['value']
				);
			}
		} elseif ( self::BUILDER_GUTENBERG === $builder ) {
			foreach ( BlockParser::extract( (string) $post->post_content ) as $f ) {
				$add( $f['path'], $f['kind'], $f['block'], self::block_label( $f['block'], $f['kind'], $f['attr'] ), $f['value'] );
			}
		} elseif ( '' !== (string) $post->post_content ) {
			$add( PostFieldTranslator::PATH_BODY, 'plain', 'post:body', __( 'Body (classic)', 'gemtranslate' ), (string) $post->post_content );
		}

		return [
			'builder'          => $builder,
			'elementor_active' => ElementorTranslator::is_active(),
			'units'            => $units,
		];
	}

	/**
	 * Tokenised source text (the storage key) for a unit id, or '' when the id
	 * no longer exists in the live source.
	 */
	public static function source_for( $post, $unit_id ) {
		foreach ( self::enumerate( $post, '' )['units'] as $u ) {
			if ( $u['id'] === $unit_id ) {
				return $u['source'];
			}
		}
		return '';
	}

	public static function block_label( $block, $kind, $attr ) {
		$label = $block;
		if ( class_exists( '\WP_Block_Type_Registry' ) ) {
			$type = \WP_Block_Type_Registry::get_instance()->get_registered( $block );
			if ( $type && ! empty( $type->title ) ) {
				$label = $type->title;
			}
		}
		if ( $label === $block ) {
			$label = ucwords( str_replace( [ '-', '_' ], ' ', substr( strrchr( '/' . $block, '/' ), 1 ) ) );
		}
		if ( 'attr' !== $kind ) {
			return $label;
		}
		// "dayLabel" / "not_found_text" => "day label" / "not found text"
		$words = strtolower( trim( preg_replace( '/(?<=[a-z])(?=[A-Z])|[_-]/', ' ', (string) $attr ) ) );
		return $label . ' · ' . $words;
	}

	public static function elementor_label( $widget, $setting ) {
		$w = ucwords( str_replace( [ '-', '_' ], ' ', $widget ) );
		// "tabs.0.tab_title" => "tab title (#1)"
		if ( preg_match( '/^(.*?)\.(\d+)\.(.+)$/', $setting, $m ) ) {
			return sprintf( '%s · %s (#%d)', $w, str_replace( '_', ' ', $m[3] ), (int) $m[2] + 1 );
		}
		return $w . ' · ' . str_replace( '_', ' ', $setting );
	}

	private static function stringify_tokens( array $tokens ) {
		$out = [];
		foreach ( $tokens as $n => $value ) {
			$out[ (string) $n ] = $value;
		}
		return $out;
	}
}

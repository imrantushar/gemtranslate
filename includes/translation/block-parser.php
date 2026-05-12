<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Block-aware text extraction & rewrite.
 *
 * Given a Gutenberg block document, walks every block (including inner
 * blocks) and yields the translatable text per block as a flat list. When
 * the translator returns the same-shaped list back, we re-assemble the
 * document by writing each translated value into its block.
 *
 * What counts as translatable per block:
 * - paragraph / heading / list-item / quote / pullquote / button / verse:
 *   the block's `innerHTML`/`innerContent`.
 * - image / video: the `alt` and `caption` attributes.
 * - cover / button: `text` / `placeholder` attributes when present.
 * - Anything else with `innerHTML` content is included by default.
 *
 * Implementation detail: each "field" is identified by a path like
 * `0` (top-level block index), `0.attrs.alt`, or `2.0.innerHTML`. That
 * lets the rewrite pass apply translations without re-parsing.
 */
class BlockParser {

	const ATTR_FIELDS = [
		'core/image'        => [ 'alt', 'caption' ],
		'core/video'        => [ 'caption' ],
		'core/audio'        => [ 'caption' ],
		'core/cover'        => [ 'alt' ],
		'core/button'       => [ 'text' ],
		'core/buttons'      => [],
		'core/gallery'      => [ 'caption' ],
		'core/media-text'   => [ 'mediaAlt' ],
		'core/embed'        => [ 'caption' ],
		'core/file'         => [ 'fileName' ],
	];

	/**
	 * Detect whether content uses block markup.
	 */
	public static function is_block_content( $content ) {
		return is_string( $content ) && false !== strpos( $content, '<!-- wp:' );
	}

	/**
	 * Extract translatable fields from block content.
	 *
	 * @return array<array{path:string,kind:'innerHTML'|'attr',attr:string,block:string,value:string}>
	 */
	public static function extract( $content ) {
		if ( ! self::is_block_content( $content ) ) {
			return [];
		}
		$blocks = parse_blocks( (string) $content );
		$out    = [];
		self::walk( $blocks, '', $out );
		return $out;
	}

	/**
	 * Apply translated values back to block content.
	 *
	 * @param string $content Original block content.
	 * @param array<string,string> $translations  Map of path => translated value.
	 * @return string Re-serialised block document.
	 */
	public static function apply( $content, array $translations ) {
		if ( ! self::is_block_content( $content ) || empty( $translations ) ) {
			return $content;
		}
		$blocks = parse_blocks( (string) $content );
		self::write( $blocks, '', $translations );
		return self::serialize_blocks( $blocks );
	}

	private static function walk( array &$blocks, $prefix, array &$out ) {
		foreach ( $blocks as $i => &$block ) {
			$path = $prefix === '' ? (string) $i : $prefix . '.' . $i;
			$name = $block['blockName'] ?? null;
			if ( null === $name ) {
				continue; // freeform / classic-block placeholder
			}

			$inner_html = isset( $block['innerHTML'] ) ? trim( $block['innerHTML'] ) : '';
			if ( '' !== $inner_html ) {
				$out[] = [
					'path'  => $path . '.innerHTML',
					'kind'  => 'innerHTML',
					'attr'  => '',
					'block' => $name,
					'value' => $block['innerHTML'],
				];
			}

			$attrs = self::ATTR_FIELDS[ $name ] ?? [];
			foreach ( $attrs as $a ) {
				if ( isset( $block['attrs'][ $a ] ) && '' !== trim( (string) $block['attrs'][ $a ] ) ) {
					$out[] = [
						'path'  => $path . '.attrs.' . $a,
						'kind'  => 'attr',
						'attr'  => $a,
						'block' => $name,
						'value' => (string) $block['attrs'][ $a ],
					];
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::walk( $block['innerBlocks'], $path, $out );
			}
		}
	}

	private static function write( array &$blocks, $prefix, array $translations ) {
		foreach ( $blocks as $i => &$block ) {
			$path = $prefix === '' ? (string) $i : $prefix . '.' . $i;
			$name = $block['blockName'] ?? null;
			if ( null === $name ) {
				continue;
			}

			$inner_path = $path . '.innerHTML';
			if ( isset( $translations[ $inner_path ] ) ) {
				$block['innerHTML'] = $translations[ $inner_path ];
				if ( isset( $block['innerContent'] ) && is_array( $block['innerContent'] ) ) {
					// `innerContent` interleaves strings + nulls (where inner
					// blocks slot in). Replace the first non-null with the
					// translation; keep nulls intact so structure is preserved.
					foreach ( $block['innerContent'] as $k => $piece ) {
						if ( null !== $piece ) {
							$block['innerContent'][ $k ] = $translations[ $inner_path ];
							break;
						}
					}
				}
			}

			$attrs = self::ATTR_FIELDS[ $name ] ?? [];
			foreach ( $attrs as $a ) {
				$attr_path = $path . '.attrs.' . $a;
				if ( isset( $translations[ $attr_path ] ) ) {
					$block['attrs'][ $a ] = $translations[ $attr_path ];
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::write( $block['innerBlocks'], $path, $translations );
			}
		}
	}

	private static function serialize_blocks( $blocks ) {
		if ( function_exists( 'serialize_blocks' ) ) {
			return serialize_blocks( $blocks );
		}
		// Fallback (extremely rare): minimal re-assembly via render_block.
		$out = '';
		foreach ( $blocks as $b ) {
			$out .= render_block( $b );
		}
		return $out;
	}
}

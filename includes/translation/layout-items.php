<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Catalogue of site-wide layout items that {@see LayoutTranslator} translates
 * at render time: template parts (header, footer, …), synced patterns and
 * navigation menus. The admin lists them and shows the translatable text of
 * the selected one.
 *
 * Item ids: `template_part:{theme//slug}`, `pattern:{post id}`, `navigation:{post id}`.
 */
class LayoutItems {

	const TYPE_TEMPLATE_PART = 'template_part';
	const TYPE_PATTERN       = 'pattern';
	const TYPE_NAVIGATION    = 'navigation';

	/** Block themes only: classic themes have no template parts. */
	public static function is_supported() {
		return function_exists( 'get_block_templates' );
	}

	/**
	 * @return array<int,array{id:string,type:string,title:string,detail:string}>
	 */
	public static function all() {
		$items = [];
		if ( ! self::is_supported() ) {
			return $items;
		}

		foreach ( (array) get_block_templates( [], 'wp_template_part' ) as $tpl ) {
			$items[] = [
				'id'     => self::TYPE_TEMPLATE_PART . ':' . $tpl->id,
				'type'   => self::TYPE_TEMPLATE_PART,
				'title'  => '' !== (string) $tpl->title ? (string) $tpl->title : (string) $tpl->slug,
				'detail' => (string) ( $tpl->area ?? '' ),
			];
		}

		foreach ( [ 'wp_block' => self::TYPE_PATTERN, 'wp_navigation' => self::TYPE_NAVIGATION ] as $post_type => $type ) {
			$posts = get_posts(
				[
					'post_type'      => $post_type,
					'post_status'    => 'publish',
					'posts_per_page' => 200,
					'orderby'        => 'title',
					'order'          => 'ASC',
				]
			);
			foreach ( $posts as $post ) {
				$items[] = [
					'id'     => $type . ':' . $post->ID,
					'type'   => $type,
					'title'  => '' !== $post->post_title ? $post->post_title : sprintf( '#%d', $post->ID ),
					'detail' => '',
				];
			}
		}
		return $items;
	}

	/**
	 * Items that have translatable text, with how much of it is translated into
	 * each language. Items with no text of their own (a header that only holds a
	 * page-list menu) are left out.
	 *
	 * @param string[] $languages Language codes to report progress for.
	 * @return array<int,array<string,mixed>>
	 */
	public static function overview( array $languages ) {
		$maps = [];
		foreach ( $languages as $code ) {
			$maps[ $code ] = LayoutTranslator::load_map( $code );
		}

		$out = [];
		foreach ( self::all() as $item ) {
			$sources = self::sources( $item['id'] );
			if ( ! $sources ) {
				continue;
			}
			$item['total']    = count( $sources );
			$item['progress'] = [];
			foreach ( $maps as $code => $map ) {
				$item['progress'][ $code ] = count(
					array_filter(
						$sources,
						static function ( $u ) use ( $map ) {
							return '' !== trim( (string) ( $map[ $u['source'] ] ?? '' ) );
						}
					)
				);
			}
			$out[] = $item;
		}
		return $out;
	}

	/**
	 * Block markup of an item, or null when it does not exist.
	 */
	public static function content( $id ) {
		$id = (string) $id;
		if ( false === strpos( $id, ':' ) ) {
			return null;
		}
		list( $type, $ref ) = explode( ':', $id, 2 );

		if ( self::TYPE_TEMPLATE_PART === $type ) {
			$tpl = self::is_supported() ? get_block_template( $ref, 'wp_template_part' ) : null;
			return $tpl ? (string) $tpl->content : null;
		}

		$post_type = self::TYPE_PATTERN === $type ? 'wp_block' : ( self::TYPE_NAVIGATION === $type ? 'wp_navigation' : '' );
		if ( '' === $post_type ) {
			return null;
		}
		$post = get_post( (int) $ref );
		return ( $post && $post_type === $post->post_type ) ? (string) $post->post_content : null;
	}

	/**
	 * Distinct translatable texts of an item, language-independent: one row per
	 * tokenised source text.
	 *
	 * @return array<int,array{source:string,label:string,tokens:array}>|null Null when the item is unknown.
	 */
	public static function sources( $id ) {
		$content = self::content( $id );
		if ( null === $content ) {
			return null;
		}
		$content = self::expand_patterns( $content );

		$out  = [];
		$seen = [];
		foreach ( BlockParser::extract( $content ) as $f ) {
			if ( 'image' === $f['kind'] ) {
				continue;
			}
			$parsed = TokenExtractor::extract( (string) $f['value'] );
			$text   = $parsed['text'];
			// Nothing a translator can act on (markup/placeholders only).
			if ( '' === trim( preg_replace( '/\{\d+\}/', '', $text ) ) || isset( $seen[ $text ] ) ) {
				continue;
			}
			$seen[ $text ] = true;

			$tokens = [];
			foreach ( $parsed['tokens'] as $n => $value ) {
				$tokens[ (string) $n ] = $value;
			}
			$out[] = [
				'source' => $text,
				'label'  => BlockUnits::block_label( $f['block'], $f['kind'], $f['attr'] ),
				'tokens' => $tokens,
			];
		}
		return $out;
	}

	/**
	 * Translation units of an item for one language (and optional country):
	 * the item's texts paired with their translations.
	 *
	 * For a country, `translation` is the country's own text and `fallback` is
	 * what its visitors get today from the language.
	 *
	 * @return array<int,array<string,mixed>>|null Null when the item is unknown.
	 */
	public static function units( $id, $language, $country = '' ) {
		$sources = self::sources( $id );
		if ( null === $sources ) {
			return null;
		}
		$map      = LayoutTranslator::load_map( $language, $country, true );
		$fallback = '' !== (string) $country ? LayoutTranslator::load_map( $language ) : [];

		$units = [];
		foreach ( $sources as $src ) {
			$units[] = $src + [
				'translation' => $map[ $src['source'] ] ?? '',
				'fallback'    => $fallback[ $src['source'] ] ?? '',
			];
		}
		return $units;
	}

	/**
	 * Inline `core/pattern` references (what block themes use for their footers
	 * and headers) with the registered pattern's markup, so the text inside is
	 * visible to translators.
	 */
	public static function expand_patterns( $content, $depth = 0 ) {
		if ( $depth > 4 || false === strpos( $content, 'wp:pattern' ) ) {
			return $content;
		}
		$blocks   = parse_blocks( $content );
		$registry = \WP_Block_Patterns_Registry::get_instance();
		$changed  = false;
		$expand   = function ( array $list ) use ( &$expand, $registry, $depth, &$changed ) {
			$out = [];
			foreach ( $list as $block ) {
				if ( 'core/pattern' === ( $block['blockName'] ?? '' ) && ! empty( $block['attrs']['slug'] ) ) {
					$pattern = $registry->get_registered( (string) $block['attrs']['slug'] );
					if ( $pattern && isset( $pattern['content'] ) ) {
						$changed = true;
						foreach ( parse_blocks( self::expand_patterns( (string) $pattern['content'], $depth + 1 ) ) as $inner ) {
							$out[] = $inner;
						}
						continue;
					}
				}
				if ( ! empty( $block['innerBlocks'] ) ) {
					$block['innerBlocks'] = $expand( $block['innerBlocks'] );
				}
				$out[] = $block;
			}
			return $out;
		};
		$blocks = $expand( $blocks );
		return $changed ? serialize_blocks( $blocks ) : $content;
	}
}

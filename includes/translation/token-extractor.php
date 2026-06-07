<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Splits raw block field HTML into three forms the translation pipeline uses:
 *
 *   1. **Template**   — the outer block wrapper (e.g. `<p class="x">…</p>`)
 *                       with `__INNER__` marking where translated text goes.
 *                       Recomputed from CURRENT source on every render, so
 *                       attribute drift (`<p>` → `<p class="alignwide">`) is
 *                       absorbed automatically.
 *   2. **Tokens**     — inline tags ({@see INLINE_TAGS}) replaced by numbered
 *                       placeholders `{1}`, `{2}`, … Map keeps the original
 *                       tag string so render-time substitution restores it.
 *   3. **Text**       — the translator-facing form. Pure text plus `{N}`
 *                       placeholders. NEVER contains raw HTML wrappers, so a
 *                       translator typing into a textarea can't break layout.
 *
 * Plain text (titles, excerpts, attribute values) round-trips unchanged:
 * template = `__INNER__`, tokens = [], text = input.
 */
class TokenExtractor {

	/**
	 * Block-level wrapper tags we strip from a field's outer edges.
	 * Anything else falls through with no wrapper.
	 */
	const WRAPPER_TAGS = [
		'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'li', 'blockquote', 'figcaption', 'pre', 'div', 'span',
	];

	/**
	 * Inline tags that are kept inside translatable content and converted to
	 * numbered placeholders. Everything else stays as literal text.
	 */
	const INLINE_TAGS = [
		'a', 'b', 'strong', 'i', 'em', 'u', 's', 'code', 'mark',
		'sup', 'sub', 'small', 'br', 'span', 'img', 'cite', 'kbd', 'q',
	];

	const PLACEHOLDER = '__INNER__';

	/**
	 * @param string $raw Raw innerHTML or attribute value.
	 * @return array{template:string,tokens:array<int,string>,text:string}
	 */
	public static function extract( $raw ) {
		$raw = (string) $raw;

		// Peel outer whitespace; preserved in template so the rebuilt block
		// has the same surrounding whitespace as Gutenberg expects.
		if ( ! preg_match( '/^(\s*)(.*?)(\s*)$/s', $raw, $m ) ) {
			return [
				'template' => self::PLACEHOLDER,
				'tokens'   => [],
				'text'     => $raw,
			];
		}
		$leading  = $m[1];
		$core     = $m[2];
		$trailing = $m[3];

		// Try to peel one outer wrapper tag, recursively up to a small depth.
		$wrapper_open  = '';
		$wrapper_close = '';
		$depth         = 0;
		while ( $depth < 3 ) {
			$wrappers_re = implode( '|', self::WRAPPER_TAGS );
			if ( ! preg_match( '/^<(' . $wrappers_re . ')(\s[^>]*)?>(.*)<\/\1\s*>$/is', $core, $wm ) ) {
				break;
			}
			$open_tag      = '<' . $wm[1] . ( $wm[2] ?? '' ) . '>';
			$close_tag     = '</' . $wm[1] . '>';
			$wrapper_open .= $open_tag;
			$wrapper_close = $close_tag . $wrapper_close;
			$core          = $wm[3];
			$depth++;
		}

		$template = $leading . $wrapper_open . self::PLACEHOLDER . $wrapper_close . $trailing;

		// Tokenize remaining inline tags in $core.
		$tokens  = [];
		$counter = 0;
		$inlines = implode( '|', array_map( 'preg_quote', self::INLINE_TAGS ) );
		$text    = preg_replace_callback(
			'#</?(' . $inlines . ')(\s[^>]*)?/?\s*>#i',
			function( $match ) use ( &$tokens, &$counter ) {
				$counter++;
				$tokens[ $counter ] = $match[0];
				return '{' . $counter . '}';
			},
			$core
		);

		// If any HTML tags remain after inline tokenization (e.g. ABlocks composite
		// blocks like info-box whose innerHTML contains structural divs, headings,
		// etc. that the outer-wrapper peeling could not strip), tokenize them too.
		// This guarantees the translator always sees plain text + {N} tokens only.
		if ( false !== strpos( $text, '<' ) ) {
			$text = preg_replace_callback(
				'/<[^>]+>/s',
				function( $match ) use ( &$tokens, &$counter ) {
					$counter++;
					$tokens[ $counter ] = $match[0];
					return '{' . $counter . '}';
				},
				$text
			);
		}

		return [
			'template' => $template,
			'tokens'   => $tokens,
			'text'     => (string) $text,
		];
	}

	/**
	 * Re-substitute `{N}` placeholders inside $translated_text using $tokens,
	 * then drop the result into the template's `__INNER__` slot.
	 *
	 * Missing tokens (translator omitted one): silently dropped.
	 * Extra tokens (translator typed `{99}` that doesn't exist): rendered literally.
	 */
	public static function compose( $template, array $tokens, $translated_text ) {
		$detokenized = preg_replace_callback(
			'/\{(\d+)\}/',
			function( $m ) use ( $tokens ) {
				$n = (int) $m[1];
				return $tokens[ $n ] ?? $m[0];
			},
			(string) $translated_text
		);
		return str_replace( self::PLACEHOLDER, (string) $detokenized, (string) $template );
	}

	/**
	 * Count placeholders in a string. Used by the UI to warn when an AI
	 * translation came back with a mismatched token set.
	 */
	public static function placeholder_count( $text ) {
		preg_match_all( '/\{(\d+)\}/', (string) $text, $m );
		return isset( $m[1] ) ? count( $m[1] ) : 0;
	}
}

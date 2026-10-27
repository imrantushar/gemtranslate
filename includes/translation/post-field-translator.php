<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render path for `string_only` translations.
 *
 * Translators never see or touch markup. For each translatable field we run
 * the raw innerHTML through {@see TokenExtractor::extract()} which yields:
 *   - the wrapper template (outer block tag), recomputed from CURRENT source
 *     every render so attribute changes flow through automatically;
 *   - inline tags (`<strong>`, `<a>`, …) replaced by numbered placeholders;
 *   - a tokenised text form (e.g. `Hello {1}world{2}`) that is BOTH the
 *     translator-facing string AND the storage key.
 *
 * At render time we look up the translation by tokenised text, re-substitute
 * placeholders, and re-wrap in the current source's template — so layout
 * edits to the source and translator typos against markup can no longer
 * break the rendered page.
 */
class PostFieldTranslator {

	const PATH_TITLE   = 'title';
	const PATH_EXCERPT = 'excerpt';
	const PATH_BODY    = 'body';

	/** @var array<string,string> Memo of rebuilt content per "{post_id}:{lang}". */
	private static $content_memo = [];

	/** @var array<string,array<string,string>> Memo of source→translation maps per "{post_id}:{lang}". */
	private static $map_memo = [];

	/**
	 * Rebuild a post's content for the given language by re-walking the source
	 * blocks and applying any stored string translations (matched by tokenised
	 * source value).
	 */
	public static function rebuild_content( $post_id, $source_content, $language ) {
		$post_id  = (int) $post_id;
		$language = strtolower( (string) $language );
		$memo_key = $post_id . ':' . $language;

		if ( array_key_exists( $memo_key, self::$content_memo ) ) {
			return self::$content_memo[ $memo_key ];
		}

		$source = (string) $source_content;
		$map    = self::load_map( $post_id, $language );

		if ( BlockParser::is_block_content( $source ) ) {
			$translations = [];
			foreach ( BlockParser::extract( $source ) as $field ) {
				$parsed = TokenExtractor::extract( (string) $field['value'] );
				$key    = $parsed['text'];
				if ( isset( $map[ $key ] ) && '' !== $map[ $key ] ) {
					$translations[ $field['path'] ] = TokenExtractor::compose(
						$parsed['template'],
						$parsed['tokens'],
						$map[ $key ]
					);
				}
			}
			$out = empty( $translations )
				? $source
				: BlockParser::apply( $source, $translations );
		} else {
			// Classic content: tokenise the whole body as one string.
			$parsed = TokenExtractor::extract( $source );
			if ( isset( $map[ $parsed['text'] ] ) && '' !== $map[ $parsed['text'] ] ) {
				$out = TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $map[ $parsed['text'] ] );
			} else {
				$out = $source;
			}
		}

		self::$content_memo[ $memo_key ] = $out;
		return $out;
	}

	public static function translated_title( $post_id, $source_title, $language ) {
		$map    = self::load_map( (int) $post_id, strtolower( (string) $language ) );
		$parsed = TokenExtractor::extract( (string) $source_title );
		$value  = $map[ $parsed['text'] ] ?? '';
		if ( '' === $value ) {
			return $source_title;
		}
		return TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $value );
	}

	public static function translated_excerpt( $post_id, $source_excerpt, $language ) {
		$map    = self::load_map( (int) $post_id, strtolower( (string) $language ) );
		$parsed = TokenExtractor::extract( (string) $source_excerpt );
		$value  = $map[ $parsed['text'] ] ?? '';
		if ( '' === $value ) {
			return $source_excerpt;
		}
		return TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $value );
	}

	/**
	 * For the admin editor: extract every translatable field from the live
	 * source post and pair each with its stored translation.
	 *
	 * Returned shape per row:
	 *   [ 'path' => string, 'kind' => 'innerHTML'|'attr'|'plain',
	 *     'block' => string, 'attr' => string,
	 *     'source' => string (tokenised),
	 *     'translation' => string (tokenised),
	 *     'tokens' => array<int,string> (legend for the UI) ]
	 */
	public static function enumerate_fields( $post, $language ) {
		$post_id = is_object( $post ) ? (int) $post->ID : (int) $post;
		$map     = self::load_map( $post_id, strtolower( (string) $language ) );
		$rows    = [];
		$seen    = [];

		$add_row = function ( $path, $kind, $block, $attr, $raw_source ) use ( &$rows, &$seen, $map ) {
			$parsed = TokenExtractor::extract( $raw_source );
			$text   = $parsed['text'];
			if ( isset( $seen[ $text ] ) ) {
				return;
			}
			$seen[ $text ] = true;
			$rows[]        = [
				'path'        => $path,
				'kind'        => $kind,
				'block'       => $block,
				'attr'        => $attr,
				'source'      => $text,
				'translation' => $map[ $text ] ?? '',
				'tokens'      => self::stringify_tokens( $parsed['tokens'] ),
			];
		};

		$add_row( self::PATH_TITLE,   'plain', 'post:title',   '', is_object( $post ) ? (string) $post->post_title   : '' );
		$add_row( self::PATH_EXCERPT, 'plain', 'post:excerpt', '', is_object( $post ) ? (string) $post->post_excerpt : '' );

		$source_content = is_object( $post ) ? (string) $post->post_content : '';
		if ( BlockParser::is_block_content( $source_content ) ) {
			foreach ( BlockParser::extract( $source_content ) as $field ) {
				$add_row( $field['path'], $field['kind'], $field['block'], $field['attr'], (string) $field['value'] );
			}
		} elseif ( '' !== $source_content ) {
			$add_row( self::PATH_BODY, 'plain', 'post:body', '', $source_content );
		}
		return $rows;
	}

	/**
	 * Tokenise a single source string. Public so the REST save path can
	 * derive the same key the render path uses.
	 */
	public static function tokenise( $raw ) {
		return TokenExtractor::extract( (string) $raw )['text'];
	}

	public static function flush_memo() {
		self::$content_memo = [];
		self::$map_memo     = [];
	}

	private static function load_map( $post_id, $language ) {
		$memo_key = $post_id . ':' . $language;
		if ( ! array_key_exists( $memo_key, self::$map_memo ) ) {
			self::$map_memo[ $memo_key ] = TranslationLoader::load_string_translations_for_post( $post_id, $language );
		}
		return self::$map_memo[ $memo_key ];
	}

	/** Stringify int keys so wp_json_encode keeps them as JSON keys. */
	private static function stringify_tokens( array $tokens ) {
		$out = [];
		foreach ( $tokens as $n => $value ) {
			$out[ (string) $n ] = $value;
		}
		return $out;
	}
}

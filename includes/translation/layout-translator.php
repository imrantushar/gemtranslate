<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;

/**
 * Translates site-wide layout: template parts (header, footer, …), synced
 * patterns and navigation menus built with blocks.
 *
 * WordPress renders these through `core/template-part`, `core/block` and
 * `core/navigation`; every block inside them passes through `render_block_data`
 * with its own parsed array. While one of those containers is rendering we
 * translate each inner block's own text and attributes there, using the same
 * tokenised-source-text keys as post content ({@see PostFieldTranslator}), so a
 * translated footer applies to every page and survives layout edits.
 *
 * A translation can be limited to one country (`fr` + `CA` is stored as
 * `fr_ca`). Visitors from that country get the country's text where it exists
 * and the language's text everywhere else.
 *
 * Blocks inside `core/post-content` are skipped: the post's own translation
 * (the_content filter) already handles them.
 */
class LayoutTranslator {

	const DOMAIN  = 'gtrans:layout';
	const CONTEXT = 'layout';

	/** Blocks whose inner blocks come from a shared layout item. */
	const CONTAINERS = [ 'core/template-part', 'core/block', 'core/navigation' ];

	/** @var string[] Open container names, innermost last. */
	private static $stack = [];

	/** @var int Open `core/post-content` blocks; > 0 means "this is post content". */
	private static $post_content = 0;

	/** @var array<string,array<string,string>> Source → translation maps, per language/country. */
	private static $map_memo = [];

	public static function init() {
		$self = new self();
		// Last, so we only track containers that really render (nobody short-circuited them).
		add_filter( 'pre_render_block', [ $self, 'enter' ], PHP_INT_MAX, 2 );
		add_filter( 'render_block', [ $self, 'leave' ], -PHP_INT_MAX, 2 );
		add_filter( 'render_block_data', [ $self, 'translate_block' ], 10, 1 );
	}

	public function enter( $pre, $parsed_block ) {
		if ( null !== $pre ) {
			return $pre;
		}
		$name = $parsed_block['blockName'] ?? '';
		if ( 'core/post-content' === $name ) {
			self::$post_content++;
		} elseif ( in_array( $name, self::CONTAINERS, true ) ) {
			self::$stack[] = $name;
		}
		return $pre;
	}

	public function leave( $content, $parsed_block ) {
		$name = $parsed_block['blockName'] ?? '';
		if ( 'core/post-content' === $name && self::$post_content > 0 ) {
			self::$post_content--;
		} elseif ( in_array( $name, self::CONTAINERS, true ) && self::$stack ) {
			array_pop( self::$stack );
		}
		return $content;
	}

	public function translate_block( $parsed_block ) {
		if ( empty( self::$stack ) || self::$post_content > 0 || ! is_array( $parsed_block ) ) {
			return $parsed_block;
		}
		if ( empty( $parsed_block['blockName'] ) || Context::is_default() || EditorContext::is_render_target() ) {
			return $parsed_block;
		}

		$map = self::load_map( Context::current(), CountryContext::current() );
		if ( ! $map ) {
			return $parsed_block;
		}

		$translations = [];
		foreach ( BlockParser::extract_block( $parsed_block ) as $field ) {
			$parsed = TokenExtractor::extract( (string) $field['value'] );
			$key    = $parsed['text'];
			if ( isset( $map[ $key ] ) && '' !== $map[ $key ] ) {
				$translations[ $field['path'] ] = TokenExtractor::compose( $parsed['template'], $parsed['tokens'], $map[ $key ] );
			}
		}
		return BlockParser::apply_block( $parsed_block, $translations );
	}

	/**
	 * Key a translation is stored under: the language code, or `fr_ca` for a
	 * country variant of it (fits the `language_code` column, no schema change).
	 */
	public static function variant_key( $language, $country = '' ) {
		$language = strtolower( (string) $language );
		$country  = CountryContext::normalize( $country );
		return ( '' !== $language && '' !== $country ) ? $language . '_' . strtolower( $country ) : $language;
	}

	/**
	 * Save one layout string. The tokenised source text is the key, exactly as
	 * for post strings. An empty translation clears it (a country then falls
	 * back to the language's text).
	 */
	public static function save( $source, $language, $translation, $purge = true, $country = '' ) {
		$source = (string) $source;
		$key    = self::variant_key( $language, $country );
		if ( '' === $source || '' === $key ) {
			return false;
		}
		$string_id = StringTranslator::register_string( $source, self::DOMAIN, self::CONTEXT );
		if ( ! $string_id ) {
			return false;
		}
		self::$map_memo = [];
		$ok = StringTranslator::save_translation(
			$string_id,
			$key,
			(string) $translation,
			'' === (string) $translation ? 'draft' : 'translated'
		);
		if ( $ok && $purge ) {
			// A layout string appears on every page: purge the whole page cache.
			do_action( 'gtrans_translation_saved', 0 );
		}
		return $ok;
	}

	/**
	 * Source text => translation, loaded once per request.
	 *
	 * With a country, the country's own translations are layered over the
	 * language's; `$country_only` returns just the country's overrides (admin).
	 *
	 * @return array<string,string>
	 */
	public static function load_map( $language, $country = '', $country_only = false ) {
		$country = CountryContext::normalize( $country );
		$memo    = strtolower( (string) $language ) . '|' . $country . '|' . (int) $country_only;
		if ( isset( self::$map_memo[ $memo ] ) ) {
			return self::$map_memo[ $memo ];
		}

		$map = [];
		if ( '' === $country || ! $country_only ) {
			$map = self::query_map( self::variant_key( $language ) );
		}
		if ( '' !== $country ) {
			$over = self::query_map( self::variant_key( $language, $country ) );
			$map  = $country_only ? $over : array_merge( $map, $over );
		}
		self::$map_memo[ $memo ] = $map;
		return $map;
	}

	/**
	 * Countries that have their own translations for a language.
	 *
	 * @return string[] ISO codes.
	 */
	public static function countries_for( $language ) {
		global $wpdb;
		$st    = Helper::table( 'strings' );
		$stt   = Helper::table( 'string_translations' );
		$codes = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT t.language_code
				 FROM %i AS s INNER JOIN %i AS t ON t.string_id = s.string_id
				 WHERE s.domain = %s AND s.context = %s AND t.language_code LIKE %s AND t.value <> ''",
				$st,
				$stt,
				self::DOMAIN,
				self::CONTEXT,
				$wpdb->esc_like( strtolower( (string) $language ) . '_' ) . '__'
			)
		) ?: [];

		$out = [];
		foreach ( $codes as $code ) {
			$out[] = strtoupper( substr( $code, -2 ) );
		}
		sort( $out );
		return $out;
	}

	private static function query_map( $key ) {
		global $wpdb;
		$st   = Helper::table( 'strings' );
		$stt  = Helper::table( 'string_translations' );
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.source, t.value
				 FROM %i AS s
				 INNER JOIN %i AS t ON t.string_id = s.string_id
				 WHERE s.domain = %s AND s.context = %s AND t.language_code = %s AND t.value <> ''",
				$st,
				$stt,
				self::DOMAIN,
				self::CONTEXT,
				$key
			),
			ARRAY_A
		) ?: [];

		$map = [];
		foreach ( $rows as $row ) {
			if ( '' !== (string) $row['source'] ) {
				$map[ (string) $row['source'] ] = (string) $row['value'];
			}
		}
		return $map;
	}
}

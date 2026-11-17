<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;

/**
 * Country-specific layouts: show visitors from a country (optionally only in
 * one language) a different template part, for example `footer-ca` instead of
 * `footer`. The alternate part is a normal template part built in the Site
 * Editor, so it keeps its own blocks and can be translated like any other.
 *
 * Rules are stored per template part id (`theme//slug`):
 *   [ 'theme//footer' => [ [ 'country' => 'CA', 'lang' => '', 'use' => 'theme//footer-ca' ], … ] ]
 */
class LayoutVariants {

	const OPTION = 'gtrans_layout_variants';

	/** @var array<string,bool> Replacement template parts that exist, per request. */
	private static $exists = [];

	public static function init() {
		// Before LayoutTranslator (10), so the swapped part is what gets translated.
		add_filter( 'render_block_data', [ new self(), 'swap' ], 5, 1 );
	}

	public function swap( $parsed_block ) {
		if ( ( $parsed_block['blockName'] ?? '' ) !== 'core/template-part' || empty( $parsed_block['attrs']['slug'] ) ) {
			return $parsed_block;
		}
		$country = CountryContext::current();
		$theme   = $parsed_block['attrs']['theme'] ?? get_stylesheet();
		$id    = $theme . '//' . $parsed_block['attrs']['slug'];

		$use = self::resolve( $id, $country, Context::current() );
		if ( null !== $use && self::part_exists( $use ) ) {
			$parsed_block['attrs']['slug'] = substr( $use, strpos( $use, '//' ) + 2 );
		}
		return $parsed_block;
	}

	/**
	 * Template part to use instead of $part for this visitor, or null.
	 * A rule for the country and language beats a country-only rule.
	 */
	public static function resolve( $part, $country, $lang ) {
		// Specificity: country + language (3) > country only (2) > language only (1).
		$best       = null;
		$best_score = 0;
		foreach ( self::for_part( $part ) as $rule ) {
			if ( '' !== $rule['country'] && $rule['country'] !== $country ) {
				continue;
			}
			if ( '' !== $rule['lang'] && $rule['lang'] !== $lang ) {
				continue;
			}
			$score = ( '' !== $rule['country'] ? 2 : 0 ) + ( '' !== $rule['lang'] ? 1 : 0 );
			if ( $score > $best_score ) {
				$best       = $rule['use'];
				$best_score = $score;
			}
		}
		return $best;
	}

	/**
	 * Create a separate template part for one language (and optional country)
	 * and show it there instead of $part. It is an ordinary template part, so it
	 * opens in the Site Editor and can be translated like any other.
	 *
	 * @param string $part    Template part id, `theme//slug`.
	 * @param string $start   `copy` (the original's blocks) or `blank`.
	 * @return array{country:string,lang:string,use:string}|\WP_Error
	 */
	public static function create_custom( $part, $lang, $country, $start ) {
		$lang    = strtolower( (string) $lang );
		$country = CountryContext::normalize( $country );
		if ( '' === $lang || ! Context::is_active( $lang ) || Context::default_code() === $lang ) {
			return new \WP_Error( 'gtrans_invalid_lang', __( 'Pick an active, non-default language.', 'gemtranslate' ), [ 'status' => 422 ] );
		}
		$tpl = function_exists( 'get_block_template' ) ? get_block_template( $part, 'wp_template_part' ) : null;
		if ( ! $tpl ) {
			return new \WP_Error( 'gtrans_not_found', __( 'Template part not found.', 'gemtranslate' ), [ 'status' => 404 ] );
		}

		$theme    = substr( $part, 0, strpos( $part, '//' ) );
		$slug     = sanitize_title( $tpl->slug . '-' . $lang . ( '' !== $country ? '-' . strtolower( $country ) : '' ) );
		$new_id   = $theme . '//' . $slug;
		$existing = self::part_exists( $new_id );

		if ( ! $existing ) {
			$label   = strtoupper( $lang ) . ( '' !== $country ? ' · ' . $country : '' );
			$post_id = wp_insert_post(
				[
					'post_type'    => 'wp_template_part',
					'post_status'  => 'publish',
					'post_name'    => $slug,
					'post_title'   => sprintf( '%s (%s)', '' !== (string) $tpl->title ? $tpl->title : $tpl->slug, $label ),
					'post_content' => 'blank' === $start ? '' : (string) $tpl->content,
				],
				true
			);
			if ( is_wp_error( $post_id ) ) {
				return $post_id;
			}
			wp_set_object_terms( $post_id, $theme, 'wp_theme' );
			if ( ! empty( $tpl->area ) ) {
				wp_set_object_terms( $post_id, (string) $tpl->area, 'wp_template_part_area' );
			}
			self::$exists = [];
		}

		$rules   = array_values(
			array_filter(
				self::for_part( $part ),
				static function ( $r ) use ( $lang, $country ) {
					return ! ( $r['lang'] === $lang && $r['country'] === $country );
				}
			)
		);
		$rules[] = [ 'country' => $country, 'lang' => $lang, 'use' => $new_id ];
		self::save( $part, $rules );
		return [ 'country' => $country, 'lang' => $lang, 'use' => $new_id ];
	}

	/** Stop showing a custom layout for a language/country. The template part itself is kept. */
	public static function remove_custom( $part, $lang, $country ) {
		$lang    = strtolower( (string) $lang );
		$country = CountryContext::normalize( $country );
		$rules   = array_values(
			array_filter(
				self::for_part( $part ),
				static function ( $r ) use ( $lang, $country ) {
					return ! ( $r['lang'] === $lang && $r['country'] === $country );
				}
			)
		);
		return self::save( $part, $rules );
	}

	/**
	 * @return array<int,array{country:string,lang:string,use:string}>
	 */
	public static function for_part( $part ) {
		$all = self::all();
		return $all[ $part ] ?? [];
	}

	/** @return array<string,array<int,array{country:string,lang:string,use:string}>> */
	public static function all() {
		$raw = get_option( self::OPTION, [] );
		return is_array( $raw ) ? $raw : [];
	}

	/**
	 * Replace the rules of one template part. Invalid rules are dropped.
	 *
	 * @param array<int,array<string,string>> $rules
	 * @return array<int,array{country:string,lang:string,use:string}> The rules as stored.
	 */
	public static function save( $part, array $rules ) {
		$clean = [];
		$seen  = [];
		foreach ( $rules as $rule ) {
			$country = CountryContext::normalize( $rule['country'] ?? '' );
			$lang    = strtolower( (string) ( $rule['lang'] ?? '' ) );
			$use     = (string) ( $rule['use'] ?? '' );
			if ( $use === $part || ! self::part_exists( $use ) ) {
				continue;
			}
			// A rule needs a country, a language, or both.
			if ( '' === $country && '' === $lang ) {
				continue;
			}
			if ( '' !== $lang && ! Context::is_active( $lang ) ) {
				continue;
			}
			$key = $country . '|' . $lang;
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$clean[]      = [ 'country' => $country, 'lang' => $lang, 'use' => $use ];
		}

		$all = self::all();
		if ( $clean ) {
			$all[ $part ] = $clean;
		} else {
			unset( $all[ $part ] );
		}
		update_option( self::OPTION, $all );
		// Every page shows the footer: purge the whole page cache.
		do_action( 'gtrans_translation_saved', 0 );
		return $clean;
	}

	public static function part_exists( $id ) {
		$id = (string) $id;
		if ( ! isset( self::$exists[ $id ] ) ) {
			self::$exists[ $id ] = false !== strpos( $id, '//' )
				&& function_exists( 'get_block_template' )
				&& null !== get_block_template( $id, 'wp_template_part' );
		}
		return self::$exists[ $id ];
	}
}

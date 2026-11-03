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
		if ( '' === $country ) {
			return $parsed_block;
		}
		$theme = $parsed_block['attrs']['theme'] ?? get_stylesheet();
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
		$best = null;
		foreach ( self::for_part( $part ) as $rule ) {
			if ( $rule['country'] !== $country ) {
				continue;
			}
			if ( '' === $rule['lang'] ) {
				$best = $best ?? $rule['use'];
			} elseif ( $rule['lang'] === $lang ) {
				return $rule['use'];
			}
		}
		return $best;
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
			if ( '' === $country || $use === $part || ! self::part_exists( $use ) ) {
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

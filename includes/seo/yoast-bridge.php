<?php
namespace Zentranslate\SEO;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\Context;
use Zentranslate\Translation\TranslationLoader;

/**
 * Swaps Yoast SEO meta fields per active language. Only loads when Yoast
 * is active.
 */
class YoastBridge {

	public static function init() {
		if ( ! defined( 'WPSEO_VERSION' ) ) {
			return;
		}
		$self = new self();
		add_filter( 'wpseo_title', [ $self, 'filter_meta_title' ] );
		add_filter( 'wpseo_metadesc', [ $self, 'filter_meta_desc' ] );
		add_filter( 'wpseo_opengraph_title', [ $self, 'filter_og_title' ] );
		add_filter( 'wpseo_opengraph_desc', [ $self, 'filter_og_desc' ] );
		add_filter( 'wpseo_canonical', [ $self, 'filter_canonical' ] );
	}

	public function filter_meta_title( $value )   { return $this->lookup( $value, 'meta_title' ); }
	public function filter_meta_desc( $value )    { return $this->lookup( $value, 'meta_desc' ); }
	public function filter_og_title( $value )     { return $this->lookup( $value, 'og_title' ); }
	public function filter_og_desc( $value )      { return $this->lookup( $value, 'og_desc' ); }
	public function filter_canonical( $value )    { return $this->lookup( $value, 'canonical_override' ); }

	private function lookup( $original, $field ) {
		if ( Context::is_default() ) {
			return $original;
		}
		$post = get_post();
		if ( ! $post ) {
			return $original;
		}
		$group = TranslationLoader::group_id_for_post( $post->ID );
		if ( ! $group ) {
			return $original;
		}
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM " . Helper::table( 'seo_meta' ) . " WHERE group_id = %d AND language_code = %s LIMIT 1",
				$group,
				Context::current()
			),
			ARRAY_A
		);
		if ( $row && '' !== (string) ( $row[ $field ] ?? '' ) ) {
			return $row[ $field ];
		}
		return $original;
	}
}

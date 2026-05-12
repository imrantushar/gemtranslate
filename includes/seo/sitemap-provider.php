<?php
namespace Zentranslate\SEO;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Routing\UrlRewriter;

/**
 * Adds language-suffixed URLs to WordPress's core XML sitemap.
 *
 * Strategy: filter the entry list provider results to inject one entry per
 * non-default language for each URL.
 */
class SitemapProvider {

	public static function init() {
		$self = new self();
		add_filter( 'wp_sitemaps_posts_entry', [ $self, 'enrich_post_entry' ], 10, 3 );
		add_filter( 'wp_sitemaps_taxonomies_entry', [ $self, 'enrich_term_entry' ], 10, 3 );
	}

	/**
	 * Add xhtml:link alternates to each post entry.
	 */
	public function enrich_post_entry( $entry, $post, $post_type ) {
		return $this->add_alternates( $entry, $post && isset( $post->ID ) ? get_permalink( $post ) : ( $entry['loc'] ?? '' ) );
	}

	public function enrich_term_entry( $entry, $term, $taxonomy ) {
		$link = $term && isset( $term->term_id ) ? get_term_link( $term, $taxonomy ) : ( $entry['loc'] ?? '' );
		if ( is_wp_error( $link ) ) {
			return $entry;
		}
		return $this->add_alternates( $entry, $link );
	}

	private function add_alternates( $entry, $original_url ) {
		$languages = Context::active_languages();
		if ( count( $languages ) <= 1 || ! $original_url ) {
			return $entry;
		}
		$rewriter  = new UrlRewriter();
		$default   = Context::default_code();
		$alternates = [];
		foreach ( $languages as $code => $lang ) {
			$hreflang = isset( $lang['locale'] ) ? str_replace( '_', '-', $lang['locale'] ) : $code;
			$alternates[] = [
				'hreflang' => $hreflang,
				'href'     => $rewriter->prepend_language( $original_url, $code === $default ? '' : $code ),
			];
		}
		$entry['ztrans_alternates'] = $alternates;
		return $entry;
	}
}

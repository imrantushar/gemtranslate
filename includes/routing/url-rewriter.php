<?php
namespace GemTranslate\Routing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;

/**
 * Prepends /{lang}/ to outgoing site URLs when the current language is
 * non-default. Short-circuits aggressively on the default language to keep
 * the hot path cheap.
 */
class UrlRewriter {

	public static function init() {
		$self = new self();

		// Site-relative URLs — these cover most theme/plugin output.
		add_filter( 'home_url', [ $self, 'filter_home_url' ], 10, 4 );
		add_filter( 'network_home_url', [ $self, 'filter_home_url' ], 10, 3 );

		// Post / page / CPT / term URLs.
		add_filter( 'post_link', [ $self, 'filter_post_link' ], 10, 2 );
		add_filter( 'page_link', [ $self, 'filter_post_link' ], 10, 2 );
		add_filter( 'post_type_link', [ $self, 'filter_post_link' ], 10, 2 );
		add_filter( 'term_link', [ $self, 'filter_term_link' ], 10, 3 );
		add_filter( 'attachment_link', [ $self, 'filter_post_link' ], 10, 2 );
	}

	/**
	 * Filter `home_url`. WP signature: ( $url, $path, $orig_scheme, $blog_id ).
	 */
	public function filter_home_url( $url, $path = '', $orig_scheme = null, $blog_id = null ) {
		if ( Context::is_default() ) {
			return $url;
		}
		// Skip non-frontend contexts (admin, login, REST).
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return $url;
		}
		return $this->prepend_language( $url, Context::current() );
	}

	public function filter_post_link( $url, $post = null ) {
		if ( Context::is_default() ) {
			return $url;
		}
		return $this->prepend_language( $url, Context::current() );
	}

	public function filter_term_link( $url, $term = null, $taxonomy = null ) {
		if ( Context::is_default() ) {
			return $url;
		}
		return $this->prepend_language( $url, Context::current() );
	}

	/**
	 * Insert `/{lang}` after the site root in any absolute or root-relative URL.
	 *
	 * Uses get_option('home') for the base-URL comparison instead of home_url()
	 * to avoid re-triggering this filter and causing infinite recursion.
	 *
	 * @param string $url
	 * @param string $lang
	 * @return string
	 */
	public function prepend_language( $url, $lang ) {
		if ( '' === $url || ! $lang ) {
			return $url;
		}

		// get_option('home') gives us the raw stored URL without going through
		// the home_url filter, preventing the recursive call that home_url('/')
		// would cause here (filter_home_url → prepend_language → home_url('/') → loop).
		$home          = untrailingslashit( get_option( 'home' ) ) . '/';
		$home_parsed   = wp_parse_url( $home );
		$home_host     = $home_parsed['host'] ?? '';
		$home_path     = isset( $home_parsed['path'] ) ? rtrim( $home_parsed['path'], '/' ) : '';

		$parsed = wp_parse_url( $url );
		if ( ! $parsed ) {
			return $url;
		}

		// Skip external hosts.
		if ( ! empty( $parsed['host'] ) && $home_host && $parsed['host'] !== $home_host ) {
			return $url;
		}

		$path     = $parsed['path'] ?? '/';
		$relative = $home_path ? preg_replace( '#^' . preg_quote( $home_path, '#' ) . '#', '', $path ) : $path;
		if ( '' === $relative ) {
			$relative = '/';
		}

		// Don't double-prefix.
		if ( preg_match( '#^/' . preg_quote( $lang, '#' ) . '(/|$)#', $relative ) ) {
			return $url;
		}

		$new_path = ( $home_path ? $home_path : '' ) . '/' . $lang . ( '/' === $relative ? '/' : $relative );

		// Rebuild URL.
		$scheme   = $parsed['scheme'] ?? 'https';
		$host     = $parsed['host']   ?? $home_host;
		$port     = isset( $parsed['port'] ) ? ':' . $parsed['port'] : '';
		$query    = isset( $parsed['query'] ) ? '?' . $parsed['query'] : '';
		$fragment = isset( $parsed['fragment'] ) ? '#' . $parsed['fragment'] : '';

		// Absolute vs root-relative input.
		if ( empty( $parsed['host'] ) && empty( $parsed['scheme'] ) ) {
			return $new_path . $query . $fragment;
		}
		return $scheme . '://' . $host . $port . $new_path . $query . $fragment;
	}

	/**
	 * Build a language-specific URL for the current request (used by switcher).
	 *
	 * Bypasses the home_url filter entirely by building from get_option('home')
	 * directly, so the current language is not prepended on top of the target
	 * language (which would produce /es/fr/sample-page instead of /fr/sample-page).
	 */
	public function current_url_for_language( $lang ) {
		$default = Context::default_code();
		$path    = $this->current_path_without_lang();

		// set_url_scheme() normalises http/https to match the current request,
		// the same way home_url() does internally.
		$home = set_url_scheme( untrailingslashit( get_option( 'home' ) ) );

		if ( $lang === $default ) {
			return $home . $path;
		}

		return $home . '/' . $lang . ( '/' === $path ? '/' : $path );
	}

	private function current_path_without_lang() {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return '/';
		}
		$path = wp_parse_url( (string) $_SERVER['REQUEST_URI'], PHP_URL_PATH );
		if ( ! $path ) {
			return '/';
		}
		$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/';
		$relative  = preg_replace( '#^' . preg_quote( $home_path, '#' ) . '#', '/', $path );

		// After the do_parse_request fix, REQUEST_URI is already stripped of
		// the language prefix, so this regex is a no-op safety measure.
		$current = Context::current();
		if ( $current ) {
			$relative = preg_replace( '#^/' . preg_quote( $current, '#' ) . '(/|$)#', '/', $relative );
		}
		return $relative;
	}
}

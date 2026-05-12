<?php
namespace Zentranslate\Routing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;

/**
 * Detects the requested language from the URL prefix and rewrites the
 * request path so the rest of WordPress sees the unprefixed URL.
 *
 * Subdirectory strategy: example.com/es/sample-page/ → Context = 'es',
 * WP routes as if URI were /sample-page/.
 */
class RequestParser {

	public static function init() {
		$self = new self();
		add_action( 'parse_request', [ $self, 'detect_and_strip' ], 0 );
	}

	/**
	 * @param \WP $wp
	 */
	public function detect_and_strip( $wp ) {
		// Skip admin / REST / cron — these are not language-prefixed routes.
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			Context::set( Context::default_code() );
			return;
		}

		$request = (string) $wp->request;
		$first   = $this->first_segment( $request );

		if ( $first && Context::is_active( $first ) ) {
			// Strip the prefix.
			$stripped     = ltrim( substr( $request, strlen( $first ) ), '/' );
			$wp->request  = $stripped;
			Context::set( $first );

			// Also adjust REQUEST_URI so plugins that read it directly stay aligned.
			$this->rewrite_request_uri( $first );
			return;
		}

		Context::set( Context::default_code() );
	}

	private function first_segment( $request ) {
		if ( '' === $request ) {
			return '';
		}
		$parts = explode( '/', $request, 2 );
		return strtolower( $parts[0] );
	}

	private function rewrite_request_uri( $lang_prefix ) {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}
		$uri  = (string) $_SERVER['REQUEST_URI']; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$path = wp_parse_url( $uri, PHP_URL_PATH );
		if ( ! $path ) {
			return;
		}
		$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/';
		$relative  = preg_replace( '#^' . preg_quote( $home_path, '#' ) . '#', '/', $path );

		// Strip /{lang}/ from the relative path.
		$new_relative = preg_replace( '#^/' . preg_quote( $lang_prefix, '#' ) . '(/|$)#', '/', $relative );
		if ( $new_relative === $relative ) {
			return;
		}

		$new_path  = rtrim( $home_path, '/' ) . $new_relative;
		$query     = wp_parse_url( $uri, PHP_URL_QUERY );
		$new_uri   = $new_path . ( $query ? '?' . $query : '' );
		$_SERVER['REQUEST_URI'] = $new_uri;
	}
}

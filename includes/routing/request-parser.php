<?php
namespace GemTranslate\Routing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;

/**
 * Detects the requested language from the URL prefix and rewrites the
 * request path so the rest of WordPress sees the unprefixed URL.
 *
 * Subdirectory strategy: example.com/es/sample-page/ → Context = 'es',
 * WP routes as if URI were /sample-page/.
 *
 * We hook into `do_parse_request` (fires at the very start of
 * WP::parse_request(), line 148 of class-wp.php) which runs BEFORE
 * WordPress reads $_SERVER['REQUEST_URI'] for rewrite-rule matching at
 * line 174. Stripping the language prefix here means WordPress URL
 * matching sees the unprefixed path and resolves the correct post/page.
 *
 * The old approach (hooking `parse_request` action, line 418) fired AFTER
 * URL matching was complete, so modifying $wp->request had no effect on
 * the query vars — the wrong (or 404) content was loaded every time.
 */
class RequestParser {

	public static function init() {
		$self = new self();
		add_filter( 'do_parse_request', [ $self, 'detect_and_strip' ], 0, 3 );

		// `do_parse_request` fires inside WP::parse_request() which is only
		// called by WP::main(). Standard wp-admin page loads bypass WP::main()
		// entirely, so Context is never set via the filter above.
		// Hooking `init` (which fires for every request type, including all
		// wp-admin pages) lets us apply the admin language preference from
		// user meta before anything renders.
		add_action( 'init', [ $self, 'set_admin_context_from_meta' ] );
	}

	/**
	 * Called via the `do_parse_request` filter — before WordPress reads
	 * REQUEST_URI for rewrite-rule matching.
	 *
	 * Strips the language prefix from $_SERVER['REQUEST_URI'] so WordPress
	 * routes the bare path, and sets the language Context for the request.
	 *
	 * @param bool             $do_parse         Whether to run URL parsing (almost always true).
	 * @param \WP              $wp               Current WP environment (unused here).
	 * @param array|string     $extra_query_vars Extra query variables (unused here).
	 * @return bool Pass-through — we never short-circuit WordPress URL matching.
	 */
	public function detect_and_strip( $do_parse, $wp, $extra_query_vars = '' ) {
		// If another plugin already short-circuited parsing, respect it.
		if ( ! $do_parse ) {
			Context::set( Context::default_code() );
			return $do_parse;
		}

		// REST / cron paths carry language via params, not URL prefixes.
		if ( ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			Context::set( Context::default_code() );
			return $do_parse;
		}

		// Admin: WP::parse_request() is not invoked for standard wp-admin
		// page loads, so this branch only fires for admin-bar / admin-post
		// style requests that do go through WP::main().
		if ( is_admin() ) {
			$this->detect_admin_language();
			return $do_parse;
		}

		// --- Frontend language detection from REQUEST_URI ---

		$uri  = (string) ( $_SERVER['REQUEST_URI'] ?? '' );
		$path = (string) ( wp_parse_url( $uri, PHP_URL_PATH ) ?: '' );

		if ( '' === $path ) {
			Context::set( Context::default_code() );
			return $do_parse;
		}

		// Strip the WordPress home path (for sub-directory installs).
		// home_url() is safe here: Context is not yet 'es', so
		// UrlRewriter::filter_home_url() returns the URL unchanged.
		$home_path     = (string) ( wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/' );
		$home_path_trimmed = rtrim( $home_path, '/' );

		// Build relative path (strip home prefix, ensure leading slash).
		if ( '' !== $home_path_trimmed && 0 === strpos( $path, $home_path_trimmed ) ) {
			$relative = '/' . ltrim( substr( $path, strlen( $home_path_trimmed ) ), '/' );
		} else {
			$relative = '/' . ltrim( $path, '/' );
		}

		$first = $this->first_segment( ltrim( $relative, '/' ) );

		if ( $first && Context::is_active( $first ) ) {
			Context::set( $first );

			// Strip /{lang}/ from the relative path.
			$stripped_relative = preg_replace(
				'#^/' . preg_quote( $first, '#' ) . '(/|$)#',
				'/',
				$relative
			);

			// Translated slug lookup: if the first path segment after /{lang}/
			// matches a translated slug for the current language, swap it for
			// the source post's slug so WP::parse_request() can resolve it.
			// This is how per-language URLs work: /{lang}/{translated-slug}/
			// → routes to the source post, with translated content served via
			// TranslationLoader at render time.
			$stripped_relative = $this->resolve_translated_slug( $stripped_relative, $first );

			// Rebuild the full path and rewrite REQUEST_URI BEFORE
			// WordPress reads it at WP::parse_request() line 174.
			$new_path = $home_path_trimmed . $stripped_relative;
			$query    = wp_parse_url( $uri, PHP_URL_QUERY );
			$_SERVER['REQUEST_URI'] = $new_path . ( $query ? '?' . $query : '' );

			return $do_parse;
		}

		Context::set( Context::default_code() );
		return $do_parse;
	}

	/**
	 * Called on `init` for every request. For admin page loads that never go
	 * through WP::main() (so `do_parse_request` never fires), this is the
	 * only opportunity to set the admin language Context from user meta.
	 *
	 * The method is a no-op on the frontend — the `do_parse_request` filter
	 * already set Context there before `init` fires.
	 *
	 * We unconditionally overwrite whatever Context was set to before `init`.
	 * Between `plugins_loaded` and `init`, hooks like UrlRewriter::filter_home_url()
	 * can call Context::current(), which would set $current to the site default
	 * before we have a chance to read user meta. Overwriting here is safe because
	 * nothing meaningful has rendered yet at priority-10 init.
	 */
	public function set_admin_context_from_meta() {
		if ( ! is_admin() ) {
			return;
		}
		$this->detect_admin_language();
	}

	/**
	 * Pick the admin language from query param or user meta.
	 */
	private function detect_admin_language() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$override = isset( $_GET['gtrans_lang'] ) ? sanitize_key( wp_unslash( $_GET['gtrans_lang'] ) ) : '';
		if ( $override && Context::is_active( $override ) ) {
			Context::set( $override );
			return;
		}

		$user_id = get_current_user_id();
		if ( $user_id ) {
			$pref = (string) get_user_meta( $user_id, 'gtrans_preferred_language', true );
			if ( $pref && Context::is_active( $pref ) ) {
				Context::set( $pref );
				return;
			}
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

	/**
	 * Swap a translated slug for the source slug so WP's native resolver
	 * finds the correct post. The lookup only touches the FIRST path
	 * segment — nested paths (CPT archive/term/children) still work because
	 * only the leaf slug differs between languages.
	 *
	 * The query is a single indexed read against (language_code, slug);
	 * it short-circuits on empty paths and when nothing matches.
	 */
	private function resolve_translated_slug( $relative, $lang ) {
		$trimmed = ltrim( $relative, '/' );
		if ( '' === $trimmed ) {
			return $relative;
		}
		$segments = explode( '/', $trimmed, 2 );
		$leaf     = $segments[0];
		// Drop any trailing slash the explode left behind.
		$leaf = rtrim( $leaf, '/' );
		if ( '' === $leaf ) {
			return $relative;
		}
		global $wpdb;
		$table = \GemTranslate\Helper::table( 'post_translations' );
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT post_id FROM $table WHERE language_code = %s AND slug = %s LIMIT 1",
				$lang,
				$leaf
			),
			ARRAY_A
		);
		if ( ! $row || empty( $row['post_id'] ) ) {
			return $relative;
		}
		$source_slug = (string) get_post_field( 'post_name', (int) $row['post_id'] );
		if ( '' === $source_slug || $source_slug === $leaf ) {
			return $relative;
		}
		$rest = isset( $segments[1] ) ? '/' . $segments[1] : '/';
		return '/' . $source_slug . $rest;
	}
}

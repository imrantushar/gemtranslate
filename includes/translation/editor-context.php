<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detects whether the current request is rendering content for an editor
 * surface — Gutenberg, the classic editor, edit-tags, etc. — where post
 * content MUST be returned in its raw source form.
 *
 * Translation filters early-return based on this so that the post editor
 * never receives a translated block tree (which corrupts block validation,
 * Gutenberg's `content.raw` vs `content.rendered` invariants, and any
 * round-tripping of `post_content` through admin UIs).
 *
 * Detection signals:
 *   - Classic admin: `is_admin()` AND `$pagenow` is a post-editor screen.
 *   - REST `?context=edit`: how Gutenberg fetches a post into the editor.
 *   - REST block-rendering namespaces: server-side block render calls that
 *     expect raw input.
 *
 * Frontend rendering (template_redirect path) is intentionally NOT matched
 * here — those filters fire normally on visitor-facing pages.
 */
class EditorContext {

	const ADMIN_EDITOR_PAGES = [
		'post.php',
		'post-new.php',
		'edit.php',
		'edit-tags.php',
		'term.php',
	];

	public static function is_render_target() {
		if ( is_admin() ) {
			$pagenow = (string) ( $GLOBALS['pagenow'] ?? '' );
			if ( in_array( $pagenow, self::ADMIN_EDITOR_PAGES, true ) ) {
				return true;
			}
		}

		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			// `context=edit` is what Gutenberg sends when fetching a post for
			// the editor. WP-API also exposes it for `view` / `embed` etc.
			$ctx = '';
			if ( isset( $_REQUEST['context'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				$ctx = sanitize_key( wp_unslash( $_REQUEST['context'] ) );
			}
			if ( 'edit' === $ctx ) {
				return true;
			}
			$route = self::current_rest_route();
			if ( '' !== $route ) {
				if ( 0 === strpos( $route, '/wp/v2/block-renderer' ) ) {
					return true;
				}
				if ( 0 === strpos( $route, '/wp/v2/blocks' ) ) {
					return true;
				}
			}
		}

		return false;
	}

	private static function current_rest_route() {
		// REST_REQUEST is true, but the dispatcher's "current route" is only
		// available once dispatch runs. Until then, fall back to parsing the
		// URI relative to the REST prefix.
		if ( function_exists( 'rest_get_server' ) ) {
			$server = rest_get_server();
			if ( $server instanceof \WP_REST_Server ) {
				$reflection = null;
				try {
					$reflection = new \ReflectionClass( $server );
				} catch ( \Throwable $e ) {
					// fall through to URI parsing
				}
				if ( $reflection && $reflection->hasProperty( 'route' ) ) {
					$prop = $reflection->getProperty( 'route' );
					if ( $prop->isPublic() || method_exists( $prop, 'setAccessible' ) ) {
						$prop->setAccessible( true );
						$value = $prop->getValue( $server );
						if ( is_string( $value ) && '' !== $value ) {
							return $value;
						}
					}
				}
			}
		}
		// Fallback — strip the REST prefix off REQUEST_URI.
		$uri = (string) ( $_SERVER['REQUEST_URI'] ?? '' );
		$path = (string) ( wp_parse_url( $uri, PHP_URL_PATH ) ?: '' );
		$rest_prefix = '/' . rest_get_url_prefix() . '/';
		$pos = strpos( $path, $rest_prefix );
		if ( false === $pos ) {
			return '';
		}
		return substr( $path, $pos + strlen( $rest_prefix ) - 1 );
	}
}

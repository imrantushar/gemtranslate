<?php
namespace GemTranslate\Routing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;

/**
 * First-visit redirect based on `Accept-Language`.
 *
 * On the very first hit (no `gtrans_user_lang` cookie set) and ONLY on
 * default-language URLs, we match the visitor's preferred languages
 * against active site languages and 302 to the matched language root.
 *
 * Subsequent visits respect the cookie. Bots and crawlers are skipped to
 * avoid SEO surprises. Opt-in via `auto_redirect_browser_lang` setting.
 */
class BrowserRedirect {

	const COOKIE = 'gtrans_user_lang';

	/** Query arg the switchers add to the default-language link. */
	const CHOICE_PARAM = 'gtrans_lang';

	public static function init() {
		// Before the country/browser redirects, so an explicit choice always wins.
		add_action( 'template_redirect', [ __CLASS__, 'apply_explicit_choice' ], -1 );
		add_action( 'template_redirect', [ __CLASS__, 'maybe_redirect' ], 1 );

		// Capture chosen language into the cookie when the switcher is used.
		add_filter( 'home_url', [ __CLASS__, 'set_cookie_passively' ], 99, 2 );
	}

	public static function enabled() {
		$raw = get_option( GTRANS_SETTINGS_NAME, '{}' );
		$cfg = json_decode( $raw, true ) ?: [];
		return ! empty( $cfg['auto_redirect_browser_lang'] );
	}

	/**
	 * The visitor picked the default language in a switcher. Remember it (the
	 * cookie otherwise bounces them back to the language they just left) and
	 * drop the query arg so the clean URL is what they land on.
	 */
	public static function apply_explicit_choice() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		if ( ! isset( $_GET[ self::CHOICE_PARAM ] ) ) {
			return;
		}
		$lang = sanitize_key( wp_unslash( $_GET[ self::CHOICE_PARAM ] ) );
		if ( '' === $lang || ! Context::is_active( $lang ) || ! Context::is_default() ) {
			return;
		}
		self::write_cookie( $lang );
		\GemTranslate\Cache\NoCache::send();
		wp_safe_redirect( remove_query_arg( self::CHOICE_PARAM ), 302 );
		exit;
	}

	public static function maybe_redirect() {
		if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		if ( ! self::enabled() ) {
			return;
		}
		// Skip crawlers.
		if ( self::is_bot() ) {
			return;
		}
		// Already on a language-prefixed URL? Persist the cookie and bail.
		if ( ! Context::is_default() ) {
			self::write_cookie( Context::current() );
			return;
		}
		// Cookie set? Respect it and redirect if mismatched.
		if ( isset( $_COOKIE[ self::COOKIE ] ) ) {
			$pref = sanitize_key( $_COOKIE[ self::COOKIE ] );
			if ( $pref && Context::is_active( $pref ) && $pref !== Context::default_code() ) {
				self::redirect_to( $pref );
			}
			return;
		}
		// First visit — match Accept-Language.
		$best = self::best_match_from_accept_language();
		if ( $best && $best !== Context::default_code() ) {
			self::redirect_to( $best );
		}
	}

	public static function set_cookie_passively( $url, $path ) {
		// No-op filter — keeps the cookie fresh by reading current context.
		// We only write the cookie on real navigations via template_redirect.
		return $url;
	}

	private static function redirect_to( $lang ) {
		$path     = $_SERVER['REQUEST_URI'] ?? '/';
		$home_path = (string) ( wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/' );
		$relative = preg_replace( '#^' . preg_quote( $home_path, '#' ) . '#', '/', (string) $path );
		// Ensure single leading slash.
		$relative = '/' . ltrim( $relative, '/' );
		$target   = home_url( '/' . $lang . $relative );
		self::write_cookie( $lang );
		// The target depends on this visitor's headers, so a shared cache must
		// not remember the redirect for the next visitor.
		\GemTranslate\Cache\NoCache::send();
		wp_safe_redirect( $target, 302 );
		exit;
	}

	private static function write_cookie( $lang ) {
		if ( headers_sent() ) {
			return;
		}
		setcookie(
			self::COOKIE,
			sanitize_key( $lang ),
			[
				'expires'  => time() + ( 30 * DAY_IN_SECONDS ),
				'path'     => COOKIEPATH ?: '/',
				'domain'   => COOKIE_DOMAIN ?: '',
				'secure'   => is_ssl(),
				'samesite' => 'Lax',
			]
		);
	}

	private static function best_match_from_accept_language() {
		$header = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
		if ( '' === $header ) {
			return '';
		}
		$active = array_keys( Context::active_languages() );
		// Build an [lang => q] map from the header.
		$prefs  = [];
		foreach ( explode( ',', $header ) as $piece ) {
			$piece = trim( $piece );
			if ( '' === $piece ) {
				continue;
			}
			$parts = array_map( 'trim', explode( ';', $piece ) );
			$lang  = strtolower( str_replace( '_', '-', $parts[0] ) );
			$q     = 1.0;
			foreach ( array_slice( $parts, 1 ) as $p ) {
				if ( 0 === strpos( $p, 'q=' ) ) {
					$q = (float) substr( $p, 2 );
				}
			}
			$prefs[ $lang ] = $q;
		}
		arsort( $prefs, SORT_NUMERIC );

		foreach ( array_keys( $prefs ) as $candidate ) {
			// Exact code match.
			if ( in_array( $candidate, $active, true ) ) {
				return $candidate;
			}
			// Strip region (en-us -> en) and try again.
			$short = strtolower( explode( '-', $candidate )[0] );
			if ( in_array( $short, $active, true ) ) {
				return $short;
			}
		}
		return '';
	}

	private static function is_bot() {
		$ua = strtolower( (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) );
		if ( '' === $ua ) {
			return false;
		}
		$tells = [ 'bot', 'crawler', 'spider', 'facebookexternalhit', 'slurp', 'duckduckgo' ];
		foreach ( $tells as $t ) {
			if ( false !== strpos( $ua, $t ) ) {
				return true;
			}
		}
		return false;
	}
}

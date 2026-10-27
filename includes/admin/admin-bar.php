<?php
namespace GemTranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;

/**
 * Adds a "Language" item to the WP admin bar that quick-switches the
 * current user's admin language without having to visit their profile.
 *
 * Clicking a language sets the user meta and reloads with the new context.
 */
class AdminBar {

	public static function init() {
		$self = new self();
		add_action( 'admin_bar_menu', [ $self, 'register' ], 100 );
		add_action( 'admin_post_gtrans_set_user_lang', [ $self, 'handle_set' ] );
		add_action( 'admin_post_nopriv_gtrans_set_user_lang', [ $self, 'handle_set' ] );
	}

	public function register( $bar ) {
		$languages = Context::active_languages();
		if ( count( $languages ) <= 1 ) {
			return;
		}

		$current = Context::current();
		$active  = $languages[ $current ] ?? null;
		$label   = $active ? $active['name'] : strtoupper( $current );

		// When a logged-in admin is browsing the frontend, the switcher is a
		// preview action — it sets a visitor cookie, not their admin UI
		// preference. Hint at this in the label when the current frontend
		// language differs from their admin preference.
		$prefix = '';
		if ( ! is_admin() && is_user_logged_in() ) {
			$user_pref = (string) get_user_meta( get_current_user_id(), ProfileField::META_KEY, true );
			if ( '' === $user_pref ) {
				$user_pref = Context::default_code();
			}
			if ( $user_pref !== $current ) {
				$prefix = esc_html__( 'Preview', 'gemtranslate' ) . ' · ';
			}
		}

		$bar->add_node(
			[
				'id'    => 'gtrans-language',
				'title' => '<span class="ab-icon" style="margin-right:6px">🌐</span><span>' . $prefix . esc_html( $label ) . '</span>',
				'href'  => '#',
			]
		);

		foreach ( $languages as $code => $lang ) {
			$bar->add_node(
				[
					'id'     => 'gtrans-language-' . $code,
					'parent' => 'gtrans-language',
					'title'  => esc_html( $lang['name'] ) . ( $code === $current ? ' ✓' : '' ),
					'href'   => wp_nonce_url(
						admin_url( 'admin-post.php?action=gtrans_set_user_lang&lang=' . rawurlencode( $code ) ),
						'gtrans_set_user_lang'
					),
				]
			);
		}
	}

	public function handle_set() {
		if ( ! is_user_logged_in() ) {
			wp_die( 'forbidden', 403 );
		}
		check_admin_referer( 'gtrans_set_user_lang' );

		$lang     = isset( $_GET['lang'] ) ? sanitize_key( wp_unslash( $_GET['lang'] ) ) : '';
		$user_id  = get_current_user_id();
		$referer  = wp_get_referer() ?: admin_url();
		$came_from_admin = 0 === strpos( $referer, admin_url() );

		// Split behaviour by where the click came from:
		//
		//   - In wp-admin → set the admin's UI preference (user_meta). Persists
		//     across sessions; takes effect on next admin page load.
		//   - On the frontend → this is a preview action only. Drop a visitor
		//     cookie (same shape BrowserRedirect would set on a visitor) and
		//     redirect to /{lang}/. user_meta is left alone so the admin UI
		//     language doesn't change behind the user's back.
		if ( $came_from_admin ) {
			$this->persist_admin_preference( $user_id, $lang );
		} elseif ( '' !== $lang && Context::is_active( $lang ) ) {
			$this->set_frontend_cookie( $lang );
		} elseif ( '' === $lang ) {
			$this->clear_frontend_cookie();
		}

		$redirect = remove_query_arg( [ 'gtrans_lang' ], $referer );
		if ( $lang && ! $came_from_admin ) {
			$redirect = $this->frontend_url_for_lang( $redirect, $lang );
		}

		wp_safe_redirect( $redirect );
		exit;
	}

	/**
	 * Persist the admin UI language preference for a user. Mirrors the value
	 * into WP's native `locale` user_meta so `determine_locale()` picks it up
	 * during the next admin page load.
	 */
	private function persist_admin_preference( $user_id, $lang ) {
		if ( '' === $lang ) {
			delete_user_meta( $user_id, ProfileField::META_KEY );
			delete_user_meta( $user_id, 'locale' );
			return;
		}
		if ( ! Context::is_active( $lang ) ) {
			return;
		}
		update_user_meta( $user_id, ProfileField::META_KEY, $lang );
		$languages = Context::active_languages();
		$locale    = $languages[ $lang ]['locale'] ?? '';
		if ( ! $locale ) {
			return;
		}
		$site_locale = get_option( 'WPLANG', '' ) ?: 'en_US';
		if ( $locale !== $site_locale ) {
			update_user_meta( $user_id, 'locale', $locale );
			self::maybe_install_language_pack( $locale );
		} else {
			delete_user_meta( $user_id, 'locale' );
		}
	}

	/**
	 * Write the visitor-style language cookie that BrowserRedirect reads.
	 * Used for frontend-side previewing by logged-in admins.
	 */
	private function set_frontend_cookie( $lang ) {
		if ( headers_sent() ) {
			return;
		}
		setcookie(
			\GemTranslate\Routing\BrowserRedirect::COOKIE,
			sanitize_key( $lang ),
			time() + ( 30 * DAY_IN_SECONDS ),
			COOKIEPATH ?: '/',
			COOKIE_DOMAIN ?: ''
		);
	}

	private function clear_frontend_cookie() {
		if ( headers_sent() ) {
			return;
		}
		setcookie(
			\GemTranslate\Routing\BrowserRedirect::COOKIE,
			'',
			time() - 3600,
			COOKIEPATH ?: '/',
			COOKIE_DOMAIN ?: ''
		);
	}

	/**
	 * Download and install the WP core language pack for $locale if it is
	 * missing. Called once when the user switches their admin language, so the
	 * slight delay (HTTP to api.wordpress.org) happens on the redirect request,
	 * not on normal page loads.
	 */
	private static function maybe_install_language_pack( $locale ) {
		$mo = WP_LANG_DIR . '/' . $locale . '.mo';
		if ( file_exists( $mo ) ) {
			return;
		}
		if ( ! function_exists( 'wp_download_language_pack' ) ) {
			$install_file = ABSPATH . 'wp-admin/includes/translation-install.php';
			if ( file_exists( $install_file ) ) {
				require_once $install_file;
			}
		}
		if ( function_exists( 'wp_download_language_pack' ) ) {
			wp_download_language_pack( $locale );
		}
	}

	/**
	 * Swap the language prefix in a frontend URL. Strips any active-language
	 * prefix already present, then prepends the target language (unless it is
	 * the default, which uses no prefix).
	 */
	private function frontend_url_for_lang( $url, $lang ) {
		$parsed = wp_parse_url( $url );
		if ( ! $parsed ) {
			return $url;
		}

		$home        = untrailingslashit( get_option( 'home' ) );
		$home_parsed = wp_parse_url( $home );
		$home_path   = isset( $home_parsed['path'] ) ? rtrim( $home_parsed['path'], '/' ) : '';

		$path     = $parsed['path'] ?? '/';
		$relative = $home_path !== ''
			? preg_replace( '#^' . preg_quote( $home_path, '#' ) . '#', '', $path )
			: $path;
		if ( '' === $relative ) {
			$relative = '/';
		}

		// Strip any existing language prefix so we start from the bare path.
		foreach ( array_keys( Context::active_languages() ) as $code ) {
			if ( preg_match( '#^/' . preg_quote( $code, '#' ) . '(/|$)#', $relative ) ) {
				$relative = preg_replace( '#^/' . preg_quote( $code, '#' ) . '(/|$)#', '/', $relative );
				break;
			}
		}

		$default = Context::default_code();
		if ( $lang === $default ) {
			$new_path = $home_path . $relative;
		} else {
			$new_path = $home_path . '/' . $lang . ( '/' === $relative ? '/' : $relative );
		}

		$scheme   = $parsed['scheme'] ?? 'https';
		$host     = $parsed['host']   ?? ( wp_parse_url( $home, PHP_URL_HOST ) ?: '' );
		$port     = isset( $parsed['port'] ) ? ':' . $parsed['port'] : '';
		$query    = isset( $parsed['query'] ) ? '?' . $parsed['query'] : '';
		$fragment = isset( $parsed['fragment'] ) ? '#' . $parsed['fragment'] : '';

		return set_url_scheme( $scheme . '://' . $host . $port . $new_path . $query . $fragment );
	}
}

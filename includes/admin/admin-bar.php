<?php
namespace Zentranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;

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
		add_action( 'admin_post_ztrans_set_user_lang', [ $self, 'handle_set' ] );
		add_action( 'admin_post_nopriv_ztrans_set_user_lang', [ $self, 'handle_set' ] );
	}

	public function register( $bar ) {
		$languages = Context::active_languages();
		if ( count( $languages ) <= 1 ) {
			return;
		}

		$current = Context::current();
		$active  = $languages[ $current ] ?? null;
		$label   = $active ? $active['name'] : strtoupper( $current );

		$bar->add_node(
			[
				'id'    => 'ztrans-language',
				'title' => '<span class="ab-icon" style="margin-right:6px">🌐</span><span>' . esc_html( $label ) . '</span>',
				'href'  => '#',
			]
		);

		foreach ( $languages as $code => $lang ) {
			$bar->add_node(
				[
					'id'     => 'ztrans-language-' . $code,
					'parent' => 'ztrans-language',
					'title'  => esc_html( $lang['name'] ) . ( $code === $current ? ' ✓' : '' ),
					'href'   => wp_nonce_url(
						admin_url( 'admin-post.php?action=ztrans_set_user_lang&lang=' . rawurlencode( $code ) ),
						'ztrans_set_user_lang'
					),
				]
			);
		}
	}

	public function handle_set() {
		if ( ! is_user_logged_in() ) {
			wp_die( 'forbidden', 403 );
		}
		check_admin_referer( 'ztrans_set_user_lang' );

		$lang    = isset( $_GET['lang'] ) ? sanitize_key( wp_unslash( $_GET['lang'] ) ) : '';
		$user_id = get_current_user_id();

		if ( '' === $lang ) {
			delete_user_meta( $user_id, ProfileField::META_KEY );
		} elseif ( Context::is_active( $lang ) ) {
			update_user_meta( $user_id, ProfileField::META_KEY, $lang );
		}

		$redirect = remove_query_arg( [ 'ztrans_lang' ], wp_get_referer() ?: admin_url() );

		// On frontend pages the language is carried in the URL prefix, not user meta.
		// Redirect to the language-prefixed version so the correct content loads.
		if ( $lang && 0 !== strpos( $redirect, admin_url() ) ) {
			$redirect = $this->frontend_url_for_lang( $redirect, $lang );
		}

		wp_safe_redirect( $redirect );
		exit;
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

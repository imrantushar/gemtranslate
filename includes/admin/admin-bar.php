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

		$lang = isset( $_GET['lang'] ) ? sanitize_key( wp_unslash( $_GET['lang'] ) ) : '';
		$user_id = get_current_user_id();

		if ( '' === $lang ) {
			delete_user_meta( $user_id, ProfileField::META_KEY );
		} elseif ( Context::is_active( $lang ) ) {
			update_user_meta( $user_id, ProfileField::META_KEY, $lang );
		}

		$redirect = wp_get_referer() ?: admin_url();
		wp_safe_redirect( remove_query_arg( [ 'ztrans_lang' ], $redirect ) );
		exit;
	}
}

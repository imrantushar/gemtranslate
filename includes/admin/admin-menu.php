<?php
namespace GemTranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AdminMenu {

	const PAGE_SLUG = 'gemtranslate';

	public static function init() {
		$self = new self();
		add_action( 'admin_menu', [ $self, 'register_menu' ], 10 );
		// Runs after SDK's add_settings_page (priority 10) so "Get Pro" lands
		// at the bottom, below any License entry Pro re-parented here.
		add_action( 'admin_menu', [ $self, 'register_get_pro' ], 99 );
		add_action( 'current_screen', [ $self, 'maybe_redirect_to_pro' ] );
		add_action( 'admin_head', [ $self, 'print_get_pro_css' ] );
	}

	public function register_menu() {
		add_menu_page(
			__( 'GemTranslate', 'gemtranslate' ),
			__( 'GemTranslate', 'gemtranslate' ),
			'gtrans_translate_content',
			self::PAGE_SLUG,
			[ $this, 'render_page' ],
			'dashicons-translation',
			58
		);

		$this->register_submenus();
	}

	/**
	 * Mirror the in-app header menu in the wp-admin sidebar. The React app
	 * routes on the URL hash, so each entry links to `admin.php?page=gemtranslate#/route`
	 * (WordPress passes a full URL slug straight through as the link).
	 */
	private function register_submenus() {
		$page = self::PAGE_SLUG;

		if ( ! current_user_can( 'manage_options' ) ) {
			// Translators only have the assignments screen.
			add_submenu_page(
				$page,
				__( 'My assignments', 'gemtranslate' ),
				__( 'My assignments', 'gemtranslate' ),
				'gtrans_translate_content',
				$page,
				[ $this, 'render_page' ]
			);
			return;
		}

		$items = [
			[ '',              __( 'Dashboard', 'gemtranslate' ) ],
			[ '/languages',    __( 'Languages', 'gemtranslate' ) ],
			[ '/posts',        __( 'Posts & Pages', 'gemtranslate' ) ],
			[ '/terms',        __( 'Taxonomies', 'gemtranslate' ) ],
			[ '/strings',      __( 'Strings', 'gemtranslate' ) ],
			[ '/menus',        __( 'Menus', 'gemtranslate' ) ],
			[ '/patterns',     __( 'Patterns', 'gemtranslate' ) ],
			[ '/translators',  __( 'Translators', 'gemtranslate' ) ],
			[ '/tools',        __( 'Tools', 'gemtranslate' ) ],
			[ '/settings',     __( 'Settings', 'gemtranslate' ) ],
		];

		// Flat sidebar: only the top-level entries. The in-app header handles
		// all sub-navigation (post types, taxonomies, pattern types, settings
		// tabs, tools sub-screens) so the wp-admin sidebar stays uncluttered.
		foreach ( $items as $item ) {
			list( $route, $label ) = $item;
			// The first entry reuses the parent slug so WordPress renames it from "GemTranslate".
			$slug = '' === $route
				? $page
				: admin_url( 'admin.php?page=' . $page ) . '#' . $route;

			add_submenu_page( $page, $label, $label, 'manage_options', $slug, '' === $route ? [ $this, 'render_page' ] : '' );
		}
	}

	/**
	 * "Get Pro" sidebar entry, free-only. Clicking it hits a screen whose
	 * callback redirects to the store page with UTM (same pattern StoreEngine uses).
	 */
	public function register_get_pro() {
		if ( defined( 'GTRANS_PRO_VERSION' ) ) {
			return;
		}

		add_submenu_page(
			self::PAGE_SLUG,
			__( 'Get Pro', 'gemtranslate' ),
			'<span class="dashicons dashicons-awards" style="color:#f0b849"></span> ' . __( 'Get Pro', 'gemtranslate' ),
			'manage_options',
			'gemtranslate-get-pro',
			'__return_null'
		);
	}

	public function print_get_pro_css() {
		if ( defined( 'GTRANS_PRO_VERSION' ) ) {
			return;
		}
		echo '<style>'
			. 'a[href*="page=gemtranslate-get-pro"]{background:#FFA500!important;color:#000!important;font-weight:600;box-shadow:none!important;}'
			. 'a[href*="page=gemtranslate-get-pro"] .dashicons{color:#000!important;}'
			. '</style>';
	}

	public function maybe_redirect_to_pro( $screen ) {
		if ( ! $screen || 'gemtranslate_page_gemtranslate-get-pro' !== $screen->id ) {
			return;
		}
		$url = add_query_arg(
			[
				'utm_source'   => 'gemtranslate-plugin',
				'utm_medium'   => 'admin-dashboard',
				'utm_campaign' => 'upgrade-to-pro',
				'utm_content'  => 'get-pro-button',
				'utm_term'     => 'free-user',
				'locale'       => get_locale(),
			],
			'https://store.kodezen.com/product/gemtranslate-pro'
		);
		wp_safe_redirect( $url );
		exit;
	}

	public function render_page() {
		echo '<div id="gemtranslate-admin-root" class="gemtranslate-admin-root">';
		echo '<noscript>' . esc_html__( 'GemTranslate requires JavaScript to manage translations.', 'gemtranslate' ) . '</noscript>';
		echo '</div>';
	}
}

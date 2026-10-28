<?php
namespace GemTranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AdminMenu {

	const PAGE_SLUG = 'gemtranslate';

	public static function init() {
		$self = new self();
		add_action( 'admin_menu', [ $self, 'register_menu' ] );
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
			[ '/translators',  __( 'Translators', 'gemtranslate' ) ],
			[ '/migration',    __( 'Migration', 'gemtranslate' ) ],
			[ '/io',           __( 'Import & Export', 'gemtranslate' ) ],
			[ '/settings',     __( 'Settings', 'gemtranslate' ) ],
		];

		foreach ( $items as $item ) {
			list( $route, $label ) = $item;
			// The first entry reuses the parent slug so WordPress renames it from "GemTranslate".
			$slug = '' === $route
				? $page
				: admin_url( 'admin.php?page=' . $page ) . '#' . $route;

			add_submenu_page( $page, $label, $label, 'manage_options', $slug, '' === $route ? [ $this, 'render_page' ] : '' );
		}
	}

	public function render_page() {
		echo '<div id="gemtranslate-admin-root" class="gemtranslate-admin-root">';
		echo '<noscript>' . esc_html__( 'GemTranslate requires JavaScript to manage translations.', 'gemtranslate' ) . '</noscript>';
		echo '</div>';
	}
}

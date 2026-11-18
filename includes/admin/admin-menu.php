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
		add_action( 'admin_head', [ $self, 'print_menu_css' ] );
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

		// Nested entries mirror the in-app dropdowns. They are listed right
		// after their parent, indented with an en dash. Default children
		// (Posts, Categories, ...) are skipped: the parent already opens them.
		$children = [
			'/posts'      => $this->post_type_children(),
			'/terms'      => $this->taxonomy_children(),
			'/patterns'   => [
				[ '/patterns?type=pattern', __( 'Patterns', 'gemtranslate' ) ],
				[ '/patterns?type=navigation', __( 'Navigation', 'gemtranslate' ) ],
			],
			'/tools'      => [
				[ '/io', __( 'Import & Export', 'gemtranslate' ) ],
				[ '/migration', __( 'Migration', 'gemtranslate' ) ],
			],
			'/settings'   => [
				[ '/settings?tab=switcher', __( 'Language switcher', 'gemtranslate' ) ],
				[ '/settings?tab=geo', __( 'Country detection', 'gemtranslate' ) ],
				[ '/settings?tab=floating', __( 'Floating switcher', 'gemtranslate' ) ],
				[ '/settings?tab=advanced', __( 'Advanced', 'gemtranslate' ) ],
			],
		];

		$all = [];
		foreach ( $items as $item ) {
			$all[] = [ $item[0], $item[1], false ];
			foreach ( $children[ $item[0] ] ?? [] as $child ) {
				$all[] = [ $child[0], $child[1], true ];
			}
		}

		foreach ( $all as $item ) {
			list( $route, $label, $nested ) = $item;
			// The first entry reuses the parent slug so WordPress renames it from "GemTranslate".
			$slug = '' === $route
				? $page
				: admin_url( 'admin.php?page=' . $page ) . '#' . $route;
			$title = $label;

			add_submenu_page( $page, $title, $label, 'manage_options', $slug, '' === $route ? [ $this, 'render_page' ] : '' );

			// Tag nested entries so they can stay hidden until their parent is open.
			if ( $nested ) {
				global $submenu;
				$last = array_key_last( $submenu[ $page ] );
				$submenu[ $page ][ $last ][4] = 'gtrans-sub';
			}
		}
	}

	/**
	 * Nested entries start hidden; the React app (Layout.jsx) moves them into a
	 * child list under their parent. Styling follows GemCRM: the active parent
	 * shows its list inline, other parents show it as a hover flyout.
	 */
	public function print_menu_css() {
		$m = '#toplevel_page_gemtranslate .wp-submenu';
		echo '<style>'
			. "#adminmenu {$m}:not(.gtrans-submenu) > li.gtrans-sub{display:none}"
			. "#adminmenu {$m} li.gtrans-has-flyout{position:relative}"
			. "#adminmenu {$m} li a .gtrans-chevron{float:right;font-size:14px;line-height:1;transition:rotate .2s ease}"
			. "#adminmenu {$m} li.current > a .gtrans-chevron{rotate:90deg}"
			. "#adminmenu {$m} li > ul.gtrans-submenu{display:none;padding:0!important;margin:0!important}"
			. "#adminmenu {$m} li.current > ul.gtrans-submenu{display:block}"
			. "#adminmenu {$m} ul.gtrans-submenu li{position:relative}"
			. "#adminmenu {$m} ul.gtrans-submenu li a{font-size:13px;line-height:1.4;font-weight:400;color:rgba(240,246,252,.7)!important;box-shadow:none}"
			. "#adminmenu {$m} ul.gtrans-submenu li a::before{content:'\\21B3';padding:0 2px;color:rgba(240,246,252,.7)}"
			. "#adminmenu {$m} ul.gtrans-submenu li.current a{color:#fff!important;font-weight:500}"
			. "#adminmenu {$m} li.gtrans-has-flyout:not(.current) > ul.gtrans-submenu{position:absolute;left:100%;top:0;min-width:180px;padding:6px 0!important;background:#2c3338;border-radius:0 4px 4px 0;box-shadow:0 3px 5px rgba(0,0,0,.2);z-index:9999}"
			. "#adminmenu {$m} li.gtrans-has-flyout:not(.current):hover > ul.gtrans-submenu,#adminmenu {$m} li.gtrans-has-flyout:not(.current):focus-within > ul.gtrans-submenu{display:block}"
			. "#adminmenu {$m} li.gtrans-has-flyout:not(.current) > ul.gtrans-submenu li a{display:block;padding:6px 14px;white-space:nowrap}"
			. "#adminmenu {$m} li.gtrans-has-flyout:not(.current) > ul.gtrans-submenu li a::before{content:none}"
			. '</style>';
	}

	/** Public post types other than "post" (the Posts & Pages parent opens that). */
	private function post_type_children() {
		$out = [];
		foreach ( get_post_types( [ 'public' => true ], 'objects' ) as $type ) {
			if ( in_array( $type->name, [ 'post', 'attachment' ], true ) ) {
				continue;
			}
			$out[] = [ '/posts?type=' . $type->name, $type->labels->name ?? $type->label ];
		}
		return $out;
	}

	/** Tags, plus the WooCommerce product taxonomies when they exist. */
	private function taxonomy_children() {
		$out = [ [ '/terms?tax=post_tag', __( 'Tags', 'gemtranslate' ) ] ];
		if ( post_type_exists( 'product' ) ) {
			$out[] = [ '/terms?tax=product_cat', __( 'Product categories', 'gemtranslate' ) ];
			$out[] = [ '/terms?tax=product_tag', __( 'Product tags', 'gemtranslate' ) ];
		}
		return $out;
	}

	public function render_page() {
		echo '<div id="gemtranslate-admin-root" class="gemtranslate-admin-root">';
		echo '<noscript>' . esc_html__( 'GemTranslate requires JavaScript to manage translations.', 'gemtranslate' ) . '</noscript>';
		echo '</div>';
	}
}

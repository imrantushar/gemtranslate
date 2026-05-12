<?php
namespace Zentranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AdminMenu {

	const PAGE_SLUG = 'zentranslate';

	public static function init() {
		$self = new self();
		add_action( 'admin_menu', [ $self, 'register_menu' ] );
	}

	public function register_menu() {
		add_menu_page(
			__( 'Zentranslate', 'zentranslate' ),
			__( 'Zentranslate', 'zentranslate' ),
			'manage_options',
			self::PAGE_SLUG,
			[ $this, 'render_page' ],
			'dashicons-translation',
			58
		);
	}

	public function render_page() {
		echo '<div id="zentranslate-admin-root" class="zentranslate-admin-root">';
		echo '<noscript>' . esc_html__( 'Zentranslate requires JavaScript to manage translations.', 'zentranslate' ) . '</noscript>';
		echo '</div>';
	}
}

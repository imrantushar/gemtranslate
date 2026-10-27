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
			'manage_options',
			self::PAGE_SLUG,
			[ $this, 'render_page' ],
			'dashicons-translation',
			58
		);
	}

	public function render_page() {
		echo '<div id="gemtranslate-admin-root" class="gemtranslate-admin-root">';
		echo '<noscript>' . esc_html__( 'GemTranslate requires JavaScript to manage translations.', 'gemtranslate' ) . '</noscript>';
		echo '</div>';
	}
}

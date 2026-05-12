<?php
namespace Zentranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Server-side rendered Gutenberg block for the language switcher.
 *
 * Block: zentranslate/language-switcher
 * Attributes: display ('inline'|'dropdown'), show_flag, show_name, show_native.
 *
 * Uses the existing `[zentranslate_language_switcher]` shortcode renderer
 * so block + shortcode + widget all produce identical markup.
 */
class LanguageSwitcherBlock {

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'register_block' ] );
	}

	public function register_block() {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}

		register_block_type(
			'zentranslate/language-switcher',
			[
				'api_version'     => 2,
				'title'           => __( 'Zentranslate language switcher', 'zentranslate' ),
				'category'        => 'widgets',
				'icon'            => 'translation',
				'description'     => __( 'Show a switcher between all active languages.', 'zentranslate' ),
				'supports'        => [ 'html' => false ],
				'attributes'      => [
					'display'     => [ 'type' => 'string', 'default' => 'inline' ],
					'show_flag'   => [ 'type' => 'boolean', 'default' => true ],
					'show_name'   => [ 'type' => 'boolean', 'default' => true ],
					'show_native' => [ 'type' => 'boolean', 'default' => false ],
				],
				'render_callback' => [ $this, 'render' ],
			]
		);
	}

	public function render( $attrs ) {
		$switcher = new LanguageSwitcher();
		return $switcher->render_shortcode(
			[
				'display'     => $attrs['display'] ?? 'inline',
				'show_flag'   => ! empty( $attrs['show_flag'] ) ? '1' : '0',
				'show_name'   => ! empty( $attrs['show_name'] ) ? '1' : '0',
				'show_native' => ! empty( $attrs['show_native'] ) ? '1' : '0',
			]
		);
	}
}

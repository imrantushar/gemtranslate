<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Assets {

	public static function init() {
		$self = new self();
		add_action( 'admin_enqueue_scripts', [ $self, 'enqueue_admin' ] );
		add_action( 'enqueue_block_editor_assets', [ $self, 'enqueue_block_editor' ] );
	}

	/**
	 * Load the Zentranslate Gutenberg sidebar plugin on the post editor.
	 */
	public function enqueue_block_editor() {
		$build_dir  = ZTRANS_ASSETS_DIR_PATH . 'build/';
		$asset_file = $build_dir . 'editor.' . ZTRANS_VERSION . '.asset.php';
		$bundle_js  = $build_dir . 'editor.' . ZTRANS_VERSION . '.js';
		$bundle_css = $build_dir . 'editor.css';

		if ( ! file_exists( $bundle_js ) ) {
			return;
		}
		$asset = file_exists( $asset_file ) ? include $asset_file : [];
		$deps  = $asset['dependencies'] ?? [ 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-i18n' ];
		$ver   = $asset['version'] ?? ZTRANS_VERSION;

		wp_enqueue_script(
			'zentranslate-editor',
			ZTRANS_ASSETS_URI . 'build/editor.' . ZTRANS_VERSION . '.js',
			$deps,
			$ver,
			true
		);
		wp_localize_script(
			'zentranslate-editor',
			'ztrans',
			[
				'root'      => esc_url_raw( rest_url( ZTRANS_REST_NAMESPACE . '/' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => admin_url(),
				'version'   => ZTRANS_VERSION,
				'features'  => ztrans_feature_flags(),
			]
		);
		wp_set_script_translations( 'zentranslate-editor', 'zentranslate', ZTRANS_ROOT_DIR_PATH . 'languages' );

		if ( file_exists( $bundle_css ) ) {
			wp_enqueue_style(
				'zentranslate-editor',
				ZTRANS_ASSETS_URI . 'build/editor.css',
				[],
				$ver
			);
		}
	}

	/**
	 * Enqueue the React admin bundle on Zentranslate admin pages only.
	 */
	public function enqueue_admin( $hook ) {
		if ( strpos( (string) $hook, 'zentranslate' ) === false ) {
			return;
		}

		$build_dir  = ZTRANS_ASSETS_DIR_PATH . 'build/';
		$asset_file = $build_dir . 'backend.' . ZTRANS_VERSION . '.asset.php';
		$bundle_js  = $build_dir . 'backend.' . ZTRANS_VERSION . '.js';
		$bundle_css = $build_dir . 'backend.css';

		if ( ! file_exists( $bundle_js ) ) {
			add_action( 'admin_notices', [ $this, 'render_build_notice' ] );
			return;
		}

		$asset = file_exists( $asset_file ) ? include $asset_file : [];
		$deps  = $asset['dependencies'] ?? [ 'wp-element' ];
		$ver   = $asset['version'] ?? ZTRANS_VERSION;

		wp_enqueue_script(
			'zentranslate-backend',
			ZTRANS_ASSETS_URI . 'build/backend.' . ZTRANS_VERSION . '.js',
			$deps,
			$ver,
			true
		);

		wp_localize_script(
			'zentranslate-backend',
			'ztrans',
			[
				'root'         => esc_url_raw( rest_url( ZTRANS_REST_NAMESPACE . '/' ) ),
				'nonce'        => wp_create_nonce( 'wp_rest' ),
				'adminUrl'     => admin_url(),
				'pluginUrl'    => ZTRANS_PLUGIN_ROOT_URI,
				'version'      => ZTRANS_VERSION,
				'currentUser'  => [
					'id'         => get_current_user_id(),
					'language'   => (string) get_user_meta( get_current_user_id(), 'ztrans_preferred_language', true ),
					'canManage'  => current_user_can( 'manage_options' ),
				],
				'features'     => ztrans_feature_flags(),
			]
		);

		// Load translations for the React UI from /languages/. Generates the
		// `-{locale}-{handle}.json` lookup automatically.
		wp_set_script_translations(
			'zentranslate-backend',
			'zentranslate',
			ZTRANS_ROOT_DIR_PATH . 'languages'
		);

		if ( file_exists( $bundle_css ) ) {
			$css_handle = is_rtl() && file_exists( $build_dir . 'backend-rtl.css' ) ? 'backend-rtl.css' : 'backend.css';
			wp_enqueue_style(
				'zentranslate-backend',
				ZTRANS_ASSETS_URI . 'build/' . $css_handle,
				[],
				$ver
			);
		}
	}

	public function render_build_notice() {
		echo '<div class="notice notice-warning"><p><strong>Zentranslate:</strong> Admin bundle missing. Run <code>npm install &amp;&amp; npm run build</code> in <code>wp-content/plugins/zentranslate/</code> to build the React UI.</p></div>';
	}
}

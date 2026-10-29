<?php
namespace GemTranslate;

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
	 * Load the GemTranslate Gutenberg sidebar plugin on the post editor.
	 */
	public function enqueue_block_editor() {
		$build_dir  = GTRANS_ASSETS_DIR_PATH . 'build/';
		$asset_file = $build_dir . 'editor.' . GTRANS_VERSION . '.asset.php';
		$bundle_js  = $build_dir . 'editor.' . GTRANS_VERSION . '.js';
		$bundle_css = $build_dir . 'editor.css';

		if ( ! file_exists( $bundle_js ) ) {
			return;
		}
		$asset = file_exists( $asset_file ) ? include $asset_file : [];
		$deps  = $asset['dependencies'] ?? [ 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-i18n' ];
		$ver   = $asset['version'] ?? GTRANS_VERSION;

		wp_enqueue_script(
			'gemtranslate-editor',
			GTRANS_ASSETS_URI . 'build/editor.' . GTRANS_VERSION . '.js',
			$deps,
			$ver,
			true
		);
		wp_localize_script(
			'gemtranslate-editor',
			'gtrans',
			[
				'root'      => esc_url_raw( rest_url( GTRANS_REST_NAMESPACE . '/' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => admin_url(),
				'version'   => GTRANS_VERSION,
				'features'  => gtrans_feature_flags(),
			]
		);
		wp_set_script_translations( 'gemtranslate-editor', 'gemtranslate', GTRANS_ROOT_DIR_PATH . 'languages' );

		if ( file_exists( $bundle_css ) ) {
			wp_enqueue_style(
				'gemtranslate-editor',
				GTRANS_ASSETS_URI . 'build/editor.css',
				[],
				filemtime( $build_dir . $css_handle ) ?: $ver
			);
		}
	}

	/**
	 * Enqueue the React admin bundle on GemTranslate admin pages only.
	 */
	public function enqueue_admin( $hook ) {
		if ( strpos( (string) $hook, 'gemtranslate' ) === false ) {
			return;
		}

		// The media library picker used to choose a per-language replacement image.
		wp_enqueue_media();

		// Full-bleed app shell like GemCRM's: suppress WP's own admin notices
		// (plugin review nudges, "just reset your DB" banners, …) on our screen
		// instead of letting them stack above the React app.
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );
		remove_all_actions( 'user_admin_notices' );
		remove_all_actions( 'network_admin_notices' );

		$build_dir  = GTRANS_ASSETS_DIR_PATH . 'build/';
		$asset_file = $build_dir . 'backend.' . GTRANS_VERSION . '.asset.php';
		$bundle_js  = $build_dir . 'backend.' . GTRANS_VERSION . '.js';
		$bundle_css = $build_dir . 'backend.css';

		if ( ! file_exists( $bundle_js ) ) {
			add_action( 'admin_notices', [ $this, 'render_build_notice' ] );
			return;
		}

		$asset = file_exists( $asset_file ) ? include $asset_file : [];
		$deps  = $asset['dependencies'] ?? [ 'wp-element' ];
		$ver   = $asset['version'] ?? GTRANS_VERSION;

		wp_enqueue_script(
			'gemtranslate-backend',
			GTRANS_ASSETS_URI . 'build/backend.' . GTRANS_VERSION . '.js',
			$deps,
			$ver,
			true
		);

		wp_localize_script(
			'gemtranslate-backend',
			'gtrans',
			[
				'root'         => esc_url_raw( rest_url( GTRANS_REST_NAMESPACE . '/' ) ),
				'nonce'        => wp_create_nonce( 'wp_rest' ),
				'adminUrl'     => admin_url(),
				'pluginUrl'    => GTRANS_PLUGIN_ROOT_URI,
				'version'      => GTRANS_VERSION,
				'currentUser'  => [
					'id'         => get_current_user_id(),
					'language'   => (string) get_user_meta( get_current_user_id(), 'gtrans_preferred_language', true ),
					'canManage'  => current_user_can( 'manage_options' ),
				],
				'features'     => gtrans_feature_flags(),
			]
		);

		// Load translations for the React UI from /languages/. Generates the
		// `-{locale}-{handle}.json` lookup automatically.
		wp_set_script_translations(
			'gemtranslate-backend',
			'gemtranslate',
			GTRANS_ROOT_DIR_PATH . 'languages'
		);

		if ( file_exists( $bundle_css ) ) {
			$css_handle = is_rtl() && file_exists( $build_dir . 'backend-rtl.css' ) ? 'backend-rtl.css' : 'backend.css';
			wp_enqueue_style(
				'gemtranslate-backend',
				GTRANS_ASSETS_URI . 'build/' . $css_handle,
				[],
				$ver
			);
		}
	}

	public function render_build_notice() {
		echo '<div class="notice notice-warning"><p><strong>GemTranslate:</strong> Admin bundle missing. Run <code>npm install &amp;&amp; npm run build</code> in <code>wp-content/plugins/gemtranslate/</code> to build the React UI.</p></div>';
	}
}

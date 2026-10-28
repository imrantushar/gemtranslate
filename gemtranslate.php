<?php
/*
 * Plugin Name:		GemTranslate
 * Plugin URI:		https://gemtranslate.com
 * Description:		AI-first multilingual platform for WordPress. Fast, modern, and developer-friendly.
 * Version:			1.0.0
 * Author:			GemTranslate
 * Author URI:		https://gemtranslate.com
 * License:			GPL-3.0+
 * License URI:		http://www.gnu.org/licenses/gpl-3.0.txt
 * Text Domain:		gemtranslate
 * Domain Path:		/languages/
 * Requires PHP:	7.4
 * Requires at least: 6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class GemTranslate {

	private function __construct() {
		$this->define_constants();
		$this->set_global_settings();
		$this->load_dependency();
		register_activation_hook( __FILE__, [ $this, 'activate' ] );
		register_deactivation_hook( __FILE__, [ $this, 'deactivate' ] );
		add_action( 'plugins_loaded', [ $this, 'on_plugins_loaded' ] );
		add_action( 'gtrans_loaded', [ $this, 'init_plugin' ] );
	}

	public static function init() {
		static $instance = false;

		if ( ! $instance ) {
			$instance = new self();
		}

		return $instance;
	}

	public function define_constants() {
		define( 'GTRANS_VERSION', '1.0.0' );
		define( 'GTRANS_DB_VERSION', '1.4' );
		define( 'GTRANS_SETTINGS_NAME', 'gtrans_settings' );
		define( 'GTRANS_PLUGIN_FILE', __FILE__ );
		define( 'GTRANS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
		define( 'GTRANS_PLUGIN_SLUG', 'gemtranslate' );
		define( 'GTRANS_REST_NAMESPACE', 'gtrans/v1' );
		define( 'GTRANS_DB_PREFIX', 'gtrans_' );
		define( 'GTRANS_PLUGIN_ROOT_URI', plugins_url( '/', __FILE__ ) );
		define( 'GTRANS_ROOT_DIR_PATH', plugin_dir_path( __FILE__ ) );
		define( 'GTRANS_INCLUDES_DIR_PATH', GTRANS_ROOT_DIR_PATH . 'includes/' );
		define( 'GTRANS_ASSETS_DIR_PATH', GTRANS_ROOT_DIR_PATH . 'assets/' );
		define( 'GTRANS_TEMPLATES_DIR_PATH', GTRANS_ROOT_DIR_PATH . 'templates/' );
		define( 'GTRANS_ASSETS_URI', GTRANS_PLUGIN_ROOT_URI . 'assets/' );
	}

	public function set_global_settings() {
		$GLOBALS['gtrans_settings'] = json_decode( get_option( GTRANS_SETTINGS_NAME, '{}' ) );
	}

	public function load_dependency() {
		require_once GTRANS_INCLUDES_DIR_PATH . 'autoload.php';
		require_once GTRANS_INCLUDES_DIR_PATH . 'functions.php';
		require_once GTRANS_INCLUDES_DIR_PATH . 'hooks.php';
	}

	public function on_plugins_loaded() {
		do_action( 'gtrans_loaded' );
	}

	public function init_plugin() {
		do_action( 'gtrans_before_init' );
		$this->dispatch_hooks();
		do_action( 'gtrans_init' );
	}

	public function dispatch_hooks() {
		GemTranslate\Database::init();
		GemTranslate\Language::init();
		GemTranslate\Geo::init();
		GemTranslate\Routing::init();
		GemTranslate\Translation::init();
		GemTranslate\SEO::init();
		GemTranslate\Cache::init();
		GemTranslate\Compat::init();
		GemTranslate\API::init();
		GemTranslate\Assets::init();
		GemTranslate\Frontend::init();
		// Admin classes self-guard their hooks (admin_menu, admin_bar_menu, etc.)
		// so init runs unconditionally — keeps the admin bar switcher visible
		// when logged-in users browse the frontend too.
		GemTranslate\Admin::init();
		GemTranslate\Multisite::init();
		GemTranslate\Cli::init();
	}

	public function activate() {
		GemTranslate\Installer::init();
	}

	public function deactivate() {
		// Preserve data on deactivation; only uninstall.php removes tables/options.
	}
}

function gemtranslate_start() {
	return GemTranslate::init();
}

gemtranslate_start();

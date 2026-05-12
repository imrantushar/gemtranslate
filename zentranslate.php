<?php
/*
 * Plugin Name:		Zentranslate
 * Plugin URI:		https://zentranslate.com
 * Description:		AI-first multilingual platform for WordPress. Fast, modern, and developer-friendly.
 * Version:			1.0.0
 * Author:			Zentranslate
 * Author URI:		https://zentranslate.com
 * License:			GPL-3.0+
 * License URI:		http://www.gnu.org/licenses/gpl-3.0.txt
 * Text Domain:		zentranslate
 * Domain Path:		/languages/
 * Requires PHP:	7.4
 * Requires at least: 6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Zentranslate {

	private function __construct() {
		$this->define_constants();
		$this->set_global_settings();
		$this->load_dependency();
		register_activation_hook( __FILE__, [ $this, 'activate' ] );
		register_deactivation_hook( __FILE__, [ $this, 'deactivate' ] );
		add_action( 'plugins_loaded', [ $this, 'on_plugins_loaded' ] );
		add_action( 'ztrans_loaded', [ $this, 'init_plugin' ] );
	}

	public static function init() {
		static $instance = false;

		if ( ! $instance ) {
			$instance = new self();
		}

		return $instance;
	}

	public function define_constants() {
		define( 'ZTRANS_VERSION', '1.0.0' );
		define( 'ZTRANS_DB_VERSION', '1.0' );
		define( 'ZTRANS_SETTINGS_NAME', 'ztrans_settings' );
		define( 'ZTRANS_PLUGIN_FILE', __FILE__ );
		define( 'ZTRANS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
		define( 'ZTRANS_PLUGIN_SLUG', 'zentranslate' );
		define( 'ZTRANS_REST_NAMESPACE', 'ztrans/v1' );
		define( 'ZTRANS_DB_PREFIX', 'ztrans_' );
		define( 'ZTRANS_PLUGIN_ROOT_URI', plugins_url( '/', __FILE__ ) );
		define( 'ZTRANS_ROOT_DIR_PATH', plugin_dir_path( __FILE__ ) );
		define( 'ZTRANS_INCLUDES_DIR_PATH', ZTRANS_ROOT_DIR_PATH . 'includes/' );
		define( 'ZTRANS_ASSETS_DIR_PATH', ZTRANS_ROOT_DIR_PATH . 'assets/' );
		define( 'ZTRANS_TEMPLATES_DIR_PATH', ZTRANS_ROOT_DIR_PATH . 'templates/' );
		define( 'ZTRANS_ASSETS_URI', ZTRANS_PLUGIN_ROOT_URI . 'assets/' );
	}

	public function set_global_settings() {
		$GLOBALS['ztrans_settings'] = json_decode( get_option( ZTRANS_SETTINGS_NAME, '{}' ) );
	}

	public function load_dependency() {
		require_once ZTRANS_INCLUDES_DIR_PATH . 'autoload.php';
		require_once ZTRANS_INCLUDES_DIR_PATH . 'functions.php';
		require_once ZTRANS_INCLUDES_DIR_PATH . 'hooks.php';
	}

	public function on_plugins_loaded() {
		do_action( 'ztrans_loaded' );
	}

	public function init_plugin() {
		do_action( 'ztrans_before_init' );
		$this->dispatch_hooks();
		do_action( 'ztrans_init' );
	}

	public function dispatch_hooks() {
		Zentranslate\Database::init();
		Zentranslate\Language::init();
		Zentranslate\Routing::init();
		Zentranslate\Translation::init();
		Zentranslate\SEO::init();
		Zentranslate\AI::init();
		Zentranslate\Cache::init();
		Zentranslate\Compat::init();
		Zentranslate\API::init();
		Zentranslate\Assets::init();
		Zentranslate\Frontend::init();
		if ( is_admin() ) {
			Zentranslate\Admin::init();
		}
	}

	public function activate() {
		Zentranslate\Installer::init();
	}

	public function deactivate() {
		// Preserve data on deactivation; only uninstall.php removes tables/options.
	}
}

function zentranslate_start() {
	return Zentranslate::init();
}

zentranslate_start();

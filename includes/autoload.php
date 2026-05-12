<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Custom autoloader for the Zentranslate namespace.
 *
 * Maps `Zentranslate\Foo\BarBaz` -> `includes/foo/bar-baz.php`
 * (CamelCase -> kebab-case, backslash -> directory separator, lowercase).
 *
 * Patterned after Academy LMS's autoloader. No Composer required.
 */
class Autoload {

	private static $instance;

	private $autoload_directories = [];

	public static function get_instance() {
		if ( ! isset( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function add_namespace_directory( $namespace, $directory ) {
		$this->autoload_directories[ $namespace ] = $directory;
	}

	public function autoload( $class ) {
		foreach ( $this->autoload_directories as $namespace => $directory ) {
			if ( 0 === strpos( $class, $namespace ) ) {
				$filename = strtolower(
					preg_replace(
						[ '/^' . $namespace . '\\\/', '/([a-z])([A-Z])/', '/_/', '/\\\/' ],
						[ '', '$1-$2', '-', DIRECTORY_SEPARATOR ],
						$class
					)
				);
				$file = $directory . $filename . '.php';
				if ( is_readable( $file ) ) {
					require_once $file;
				}
			}
		}
	}

	public function __construct() {
		$this->autoload_directories['Zentranslate'] = ZTRANS_INCLUDES_DIR_PATH;
		spl_autoload_register( [ $this, 'autoload' ] );
	}
}

Autoload::get_instance();

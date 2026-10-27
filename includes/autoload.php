<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Custom autoloader for the GemTranslate namespace.
 *
 * Maps `GemTranslate\Foo\BarBaz` -> `includes/foo/bar-baz.php`
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

	/**
	 * Register a directory for a namespace. Multiple directories may be added
	 * for the SAME namespace — this is how gemtranslate-pro maps its own
	 * `GemTranslate\*` classes onto a second directory while keeping the free
	 * plugin's classes resolvable. Directories are searched in registration
	 * order; the first readable file wins.
	 */
	public function add_namespace_directory( $namespace, $directory ) {
		if ( ! isset( $this->autoload_directories[ $namespace ] ) ) {
			$this->autoload_directories[ $namespace ] = [];
		}
		$this->autoload_directories[ $namespace ][] = $directory;
	}

	public function autoload( $class ) {
		foreach ( $this->autoload_directories as $namespace => $directories ) {
			if ( 0 !== strpos( $class, $namespace ) ) {
				continue;
			}
			$filename = strtolower(
				preg_replace(
					[ '/^' . $namespace . '\\\/', '/([a-z])([A-Z])/', '/_/', '/\\\/' ],
					[ '', '$1-$2', '-', DIRECTORY_SEPARATOR ],
					$class
				)
			);
			foreach ( (array) $directories as $directory ) {
				$file = $directory . $filename . '.php';
				if ( is_readable( $file ) ) {
					require_once $file;
					return;
				}
			}
		}
	}

	public function __construct() {
		$this->add_namespace_directory( 'GemTranslate', GTRANS_INCLUDES_DIR_PATH );
		spl_autoload_register( [ $this, 'autoload' ] );
	}
}

Autoload::get_instance();

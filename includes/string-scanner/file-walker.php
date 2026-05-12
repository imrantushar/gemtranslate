<?php
namespace Zentranslate\StringScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Translation\StringTranslator;

/**
 * Walks plugin/theme directories, extracts gettext calls, registers them.
 *
 * Runs in chunks so it can be invoked from a REST call without timing out.
 */
class FileWalker {

	const MAX_FILES_PER_CHUNK = 200;
	const MAX_FILE_SIZE       = 1048576; // 1 MB

	/**
	 * Scan a directory recursively, registering every found string.
	 *
	 * @param string $dir Absolute path.
	 * @param array $opts ['skip_vendor' => bool, 'limit' => int]
	 * @return array{files:int, strings:int}
	 */
	public static function scan_directory( $dir, $opts = [] ) {
		$skip_vendor = $opts['skip_vendor'] ?? true;
		$limit       = (int) ( $opts['limit'] ?? self::MAX_FILES_PER_CHUNK );

		$files       = self::collect_files( $dir, $skip_vendor );
		$file_count  = 0;
		$string_count = 0;
		$relative_root = trailingslashit( $dir );

		foreach ( $files as $path ) {
			if ( $file_count >= $limit ) {
				break;
			}
			if ( filesize( $path ) > self::MAX_FILE_SIZE ) {
				continue;
			}
			$code = @file_get_contents( $path );
			if ( false === $code ) {
				continue;
			}
			$file_count++;
			$calls = CallExtractor::extract( $code );
			foreach ( $calls as $call ) {
				if ( '' === $call['text'] ) {
					continue;
				}
				$file_ref = str_replace( $relative_root, '', $path ) . ':' . (int) $call['line'];
				StringTranslator::register_string( $call['text'], $call['domain'], $call['context'], $file_ref );
				$string_count++;
			}
		}

		return [ 'files' => $file_count, 'strings' => $string_count ];
	}

	private static function collect_files( $dir, $skip_vendor ) {
		if ( ! is_dir( $dir ) ) {
			return [];
		}
		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveCallbackFilterIterator(
				new \RecursiveDirectoryIterator( $dir, \FilesystemIterator::SKIP_DOTS ),
				function ( $current ) use ( $skip_vendor ) {
					$name = $current->getFilename();
					if ( $current->isDir() ) {
						if ( in_array( $name, [ 'node_modules', '.git', '.svn' ], true ) ) {
							return false;
						}
						if ( $skip_vendor && in_array( $name, [ 'vendor', 'libraries' ], true ) ) {
							return false;
						}
						return true;
					}
					return self::ends_with( $name, '.php' );
				}
			)
		);

		$paths = [];
		foreach ( $iterator as $f ) {
			$paths[] = $f->getPathname();
		}
		return $paths;
	}

	private static function ends_with( $haystack, $needle ) {
		return substr( $haystack, -strlen( $needle ) ) === $needle;
	}
}

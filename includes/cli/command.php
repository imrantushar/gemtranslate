<?php
namespace GemTranslate\Cli;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\I18n\PackGenerator;
use GemTranslate\Language\Context;
use GemTranslate\Language\LanguageRegistry;
use GemTranslate\Migration\PolylangImporter;
use GemTranslate\Migration\TranslatePressImporter;
use GemTranslate\Migration\WpmlImporter;
use GemTranslate\StringScanner\FileWalker;
use GemTranslate\Translation\TranslationLoader;

/**
 * WP-CLI commands for GemTranslate.
 *
 * Usage:
 *   wp gtrans languages list
 *   wp gtrans languages add es --locale=es_ES --name=Spanish
 *   wp gtrans languages remove es
 *   wp gtrans pack generate es_ES --target-lang=es
 *   wp gtrans strings scan <target> (active_theme|all_plugins|/abs/path)
 *   wp gtrans migrate <source> (wpml|polylang|translatepress)
 *
 * Each subcommand prints WP-CLI tables / lines and exits with an error code
 * on failure (so it composes well in shell scripts).
 */
class Command {

	public static function register() {
		if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
			return;
		}
		\WP_CLI::add_command( 'gtrans', __CLASS__ );
	}

	/**
	 * Manage languages.
	 *
	 * ## OPTIONS
	 *
	 * <subcommand>
	 * : list | add | remove | default
	 *
	 * [<code>]
	 * : Language code (when subcommand is add / remove / default).
	 *
	 * [--locale=<locale>]
	 * [--name=<name>]
	 * [--native=<native>]
	 * [--rtl]
	 */
	public function languages( $args, $assoc ) {
		$sub = $args[0] ?? 'list';
		$registry = new LanguageRegistry();

		switch ( $sub ) {
			case 'list':
				$rows = array_map(
					fn( $r ) => [
						'code'    => $r['code'],
						'locale'  => $r['locale'],
						'name'    => $r['name'],
						'default' => $r['is_default'] ? 'yes' : '',
						'active'  => $r['active'] ? 'yes' : '',
					],
					$registry->all()
				);
				\WP_CLI\Utils\format_items( 'table', $rows, [ 'code', 'locale', 'name', 'default', 'active' ] );
				return;

			case 'add':
				$code = strtolower( (string) ( $args[1] ?? '' ) );
				if ( '' === $code ) {
					\WP_CLI::error( 'Missing language code.' );
				}
				$result = $registry->insert( [
					'code'        => $code,
					'locale'      => $assoc['locale'] ?? $code,
					'name'        => $assoc['name']   ?? $code,
					'native_name' => $assoc['native'] ?? ( $assoc['name'] ?? $code ),
					'is_rtl'      => ! empty( $assoc['rtl'] ) ? 1 : 0,
					'active'      => 1,
				] );
				if ( ! $result ) {
					\WP_CLI::error( "Could not add language '$code'." );
				}
				\WP_CLI::success( "Language '$code' added." );
				return;

			case 'remove':
				$code = strtolower( (string) ( $args[1] ?? '' ) );
				if ( '' === $code ) {
					\WP_CLI::error( 'Missing language code.' );
				}
				if ( ! $registry->delete( $code ) ) {
					\WP_CLI::error( "Could not remove '$code' (default language cannot be removed)." );
				}
				\WP_CLI::success( "Language '$code' removed." );
				return;

			case 'default':
				$code = strtolower( (string) ( $args[1] ?? '' ) );
				if ( '' === $code ) {
					\WP_CLI::error( 'Missing language code.' );
				}
				if ( ! $registry->get( $code ) ) {
					\WP_CLI::error( "Language '$code' not found." );
				}
				$registry->set_default( $code );
				\WP_CLI::success( "Default language set to '$code'." );
				return;

			default:
				\WP_CLI::error( "Unknown subcommand '$sub'." );
		}
	}

	/**
	 * Generate / list / delete plugin translation packs.
	 *
	 * ## OPTIONS
	 *
	 * <subcommand>
	 * : list | generate <locale> | delete <locale>
	 *
	 * [--target-lang=<code>]
	 * : Language code to build the pack from. Defaults to the language
	 *   code derived from <locale> (es_ES -> es).
	 */
	public function pack( $args, $assoc ) {
		$sub = $args[0] ?? 'list';

		if ( 'list' === $sub ) {
			$rows = array_map(
				fn( $p ) => [
					'locale' => $p['locale'],
					'po'     => $p['po'] ? 'yes' : '',
					'mo'     => $p['mo'] ? 'yes' : '',
					'json'   => $p['json'],
				],
				array_values( PackGenerator::status() )
			);
			\WP_CLI\Utils\format_items( 'table', $rows, [ 'locale', 'po', 'mo', 'json' ] );
			return;
		}

		$locale = (string) ( $args[1] ?? '' );
		if ( '' === $locale ) {
			\WP_CLI::error( 'Missing <locale>.' );
		}

		if ( 'generate' === $sub ) {
			$target = $assoc['target-lang'] ?? strtolower( explode( '_', $locale )[0] );
			\WP_CLI::log( "Generating $locale from existing translations…" );
			$result = PackGenerator::generate( $target, $locale );
			if ( is_wp_error( $result ) ) {
				\WP_CLI::error( $result->get_error_message() );
			}
			\WP_CLI::success( sprintf( '%d/%d strings translated into %s.', $result['written'], $result['total'], $result['locale'] ) );
			return;
		}

		if ( 'delete' === $sub ) {
			$removed = PackGenerator::delete( $locale );
			\WP_CLI::success( "Removed $removed file(s) for $locale." );
			return;
		}

		\WP_CLI::error( "Unknown subcommand '$sub'." );
	}

	/**
	 * Scan a theme or plugin directory for translatable strings.
	 *
	 * ## OPTIONS
	 *
	 * <target>
	 * : active_theme | all_plugins | /abs/path/to/dir
	 */
	public function strings( $args ) {
		$sub = $args[0] ?? '';
		if ( 'scan' !== $sub ) {
			\WP_CLI::error( "Usage: wp gtrans strings scan <target>" );
		}
		$target = $args[1] ?? '';
		switch ( $target ) {
			case 'active_theme':
				$dir = get_template_directory();
				break;
			case 'all_plugins':
				$dir = WP_PLUGIN_DIR;
				break;
			default:
				$dir = $target;
				if ( ! is_dir( $dir ) ) {
					\WP_CLI::error( "Target '$target' is not a directory." );
				}
		}
		$result = FileWalker::scan_directory( $dir );
		\WP_CLI::success( sprintf( "Scanned %d files; %d strings registered.", $result['files'], $result['strings'] ) );
	}

	/**
	 * Import translations from another multilingual plugin.
	 *
	 * ## OPTIONS
	 *
	 * <source>
	 * : wpml | polylang | translatepress
	 */
	public function migrate( $args ) {
		$source = $args[0] ?? '';
		switch ( $source ) {
			case 'wpml':
				$result = WpmlImporter::run();
				break;
			case 'polylang':
				$result = PolylangImporter::run();
				break;
			case 'translatepress':
				$result = TranslatePressImporter::run();
				break;
			default:
				\WP_CLI::error( "Unknown source '$source'." );
		}
		if ( ! $result->detected ) {
			\WP_CLI::error( implode( ' ', $result->errors ) ?: "$source not detected on this site." );
		}
		\WP_CLI\Utils\format_items( 'table', [ $result->to_array() ], [ 'source', 'languages', 'posts', 'terms', 'strings', 'skipped' ] );
		\WP_CLI::success( "Import complete." );
	}
}

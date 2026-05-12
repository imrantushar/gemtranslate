<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Schema migrator. Runs dbDelta on activation and on schema-version bumps.
 */
class Migrator {

	/**
	 * Run a fresh install. Idempotent thanks to dbDelta.
	 */
	public static function install() {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		global $wpdb;
		$prefix          = $wpdb->prefix . ZTRANS_DB_PREFIX;
		$charset_collate = $wpdb->get_charset_collate();

		CreateLanguagesTable::up( $prefix, $charset_collate );
		CreateTranslationGroupsTable::up( $prefix, $charset_collate );
		CreatePostTranslationsTable::up( $prefix, $charset_collate );
		CreateTermTranslationsTable::up( $prefix, $charset_collate );
		CreateMenuTranslationsTable::up( $prefix, $charset_collate );
		CreateStringsTable::up( $prefix, $charset_collate );
		CreateStringTranslationsTable::up( $prefix, $charset_collate );
		CreateSeoMetaTable::up( $prefix, $charset_collate );
		CreateSlugsTable::up( $prefix, $charset_collate );
		CreateJobsTable::up( $prefix, $charset_collate );
		CreateTranslationMemoryTable::up( $prefix, $charset_collate );
		CreateGlossaryTable::up( $prefix, $charset_collate );
		CreatePostMetaTranslationsTable::up( $prefix, $charset_collate );
		CreatePostTranslationRevisionsTable::up( $prefix, $charset_collate );

		update_option( 'ztrans_db_version', ZTRANS_DB_VERSION );
	}

	/**
	 * Run schema upgrades on `init` if the stored db version is behind.
	 */
	public static function maybe_upgrade() {
		$current = get_option( 'ztrans_db_version' );
		if ( $current === ZTRANS_DB_VERSION ) {
			return;
		}
		self::install();
	}
}

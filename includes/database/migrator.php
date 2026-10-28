<?php
namespace GemTranslate\Database;

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
		$prefix          = $wpdb->prefix . GTRANS_DB_PREFIX;
		$charset_collate = $wpdb->get_charset_collate();

		// dbDelta can add columns and indexes but cannot drop or replace a
		// PRIMARY KEY. Widen the post_translations PK to include country_code
		// BEFORE dbDelta runs — otherwise dbDelta tries to ADD a second
		// PRIMARY KEY and MySQL rejects the ALTER.
		// Requires the country_code column to exist; create it first if not.
		self::ensure_country_code_column( $prefix );
		self::ensure_post_translations_pk( $prefix );

		// Free-tier tables. Pro tables (seo_meta, post_meta_translations, post_translation_revisions) are
		// created by gemtranslate-pro's own migrator.
		CreateLanguagesTable::up( $prefix, $charset_collate );
		CreateTranslationGroupsTable::up( $prefix, $charset_collate );
		CreatePostTranslationsTable::up( $prefix, $charset_collate );
		CreateTermTranslationsTable::up( $prefix, $charset_collate );
		CreateMenuTranslationsTable::up( $prefix, $charset_collate );
		CreateStringsTable::up( $prefix, $charset_collate );
		CreateStringTranslationsTable::up( $prefix, $charset_collate );
		CreateSlugsTable::up( $prefix, $charset_collate );

		update_option( 'gtrans_db_version', GTRANS_DB_VERSION );
	}

	private static function ensure_country_code_column( $prefix ) {
		global $wpdb;
		$table = $prefix . 'post_translations';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$exists = (bool) $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
		if ( ! $exists ) {
			return; // Fresh install: dbDelta will create the table with the column.
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols = $wpdb->get_col( "SHOW COLUMNS FROM `$table` LIKE 'country_code'" );
		if ( empty( $cols ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "ALTER TABLE `$table` ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT '' AFTER language_code" );
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols = $wpdb->get_col( "SHOW COLUMNS FROM `$table` LIKE 'shadow_post_id'" );
		if ( empty( $cols ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "ALTER TABLE `$table` ADD COLUMN shadow_post_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0 AFTER post_id" );
		}
	}

	/**
	 * Run schema upgrades on `init` if the stored db version is behind.
	 */
	public static function maybe_upgrade() {
		$current = get_option( 'gtrans_db_version' );
		if ( $current === GTRANS_DB_VERSION ) {
			return;
		}
		self::install();
	}

	/**
	 * Ensure the post_translations PRIMARY KEY includes country_code.
	 * Safe to re-run — only ALTERs when the existing PK is missing the column.
	 */
	private static function ensure_post_translations_pk( $prefix ) {
		global $wpdb;
		$table = $prefix . 'post_translations';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$exists = (bool) $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
		if ( ! $exists ) {
			return; // Fresh install: dbDelta will create the table with the right PK.
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results( "SHOW KEYS FROM `$table` WHERE Key_name = 'PRIMARY'", ARRAY_A );
		if ( ! is_array( $rows ) || empty( $rows ) ) {
			return;
		}
		foreach ( $rows as $row ) {
			if ( ( $row['Column_name'] ?? '' ) === 'country_code' ) {
				return; // Already widened.
			}
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( "ALTER TABLE `$table` DROP PRIMARY KEY, ADD PRIMARY KEY (group_id, language_code, country_code)" );
	}
}

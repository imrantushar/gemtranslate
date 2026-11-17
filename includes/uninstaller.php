<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Removes everything GemTranslate stored for one site.
 *
 * Used by uninstall.php (when "Remove all data on uninstall" is on) and by the
 * multisite site-deleted hook. It has no dependency on the rest of the plugin,
 * because uninstall.php runs without the plugin loaded.
 *
 * Deliberately left alone: generated language packs in wp-content/languages
 * (user-visible translation files other plugins may read) and the `locale` user
 * meta of people who never used GemTranslate's language picker.
 */
class Uninstaller {

	/**
	 * Free, Pro and retired tables. Pro and retired ones may be absent, so each
	 * is dropped with IF EXISTS.
	 */
	const TABLES = [
		'languages', 'translation_groups', 'post_translations', 'term_translations',
		'menu_translations', 'strings', 'string_translations', 'slugs',
		// GemTranslate Pro.
		'seo_meta', 'post_meta_translations', 'post_translation_revisions', 'assignments',
		// Retired.
		'jobs', 'translation_memory', 'glossary',
	];

	const OPTIONS = [
		'gtrans_settings', 'gtrans_version', 'gtrans_db_version', 'gtrans_first_install_time',
		'gtrans_required_rewrite_flush', 'gtrans_caps_granted', 'gtrans_audit_summaries',
		'pro_db_version', // GemTranslate Pro schema version.
	];

	const POST_META = [
		'_gtrans_source_hash', '_gtrans_group_id', '_gtrans_source_lang',
		'_gtrans_translation_of', '_gtrans_lang', '_gtrans_country',
	];

	const TRANSLATOR_ROLE = 'gtrans_translator';
	const TRANSLATE_CAP   = 'gtrans_translate_content';

	/**
	 * Remove all data for the current site (call inside switch_to_blog() on
	 * multisite).
	 */
	public static function remove_current_site() {
		self::delete_shadow_posts();
		self::delete_meta();
		self::remove_roles_and_caps();
		self::delete_options();
		self::drop_tables();
	}

	public static function drop_tables() {
		global $wpdb;
		foreach ( self::TABLES as $name ) {
			$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}gtrans_{$name}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
	}

	/**
	 * Shadow posts are real `wp_posts` rows (custom-layout translations), so
	 * dropping the tables would orphan them as published pages.
	 */
	private static function delete_shadow_posts() {
		global $wpdb;
		// Query the meta table directly: a WP_Query would go through
		// pre_get_posts, where the plugin's own filter hides shadows.
		do {
			$ids = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s LIMIT 200",
					'_gtrans_translation_of'
				)
			);
			foreach ( $ids as $id ) {
				wp_delete_post( (int) $id, true );
			}
			// A row whose post is already gone would repeat forever; clear it.
			foreach ( $ids as $id ) {
				delete_post_meta( (int) $id, '_gtrans_translation_of' );
			}
		} while ( ! empty( $ids ) );
	}

	private static function delete_meta() {
		global $wpdb;
		foreach ( self::POST_META as $key ) {
			delete_post_meta_by_key( $key );
		}
		// Per-segment confirmation flags carry a dynamic suffix.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->postmeta} WHERE meta_key LIKE %s", $wpdb->esc_like( '_gtrans_seg_confirmed_' ) . '%' ) );
		delete_metadata( 'term', 0, '_gtrans_group_id', '', true );

		// The picker mirrors its choice into WP's own `locale` user meta; undo
		// that for the people who used it, then drop our keys.
		$users = get_users( [ 'meta_key' => 'gtrans_preferred_language', 'fields' => 'ID', 'number' => -1 ] ); // phpcs:ignore WordPress.DB.SlowDBQuery
		foreach ( $users as $user_id ) {
			delete_user_meta( (int) $user_id, 'locale' );
		}
		delete_metadata( 'user', 0, 'gtrans_preferred_language', '', true );
		delete_metadata( 'user', 0, 'gtrans_assigned_languages', '', true );
	}

	private static function remove_roles_and_caps() {
		// Anyone left with only the translator role would lose every capability
		// once it is removed; make them subscribers so they can still sign in.
		foreach ( get_users( [ 'role' => self::TRANSLATOR_ROLE, 'fields' => 'ID', 'number' => -1 ] ) as $user_id ) {
			$user = get_userdata( (int) $user_id );
			if ( $user ) {
				$user->remove_role( self::TRANSLATOR_ROLE );
				if ( empty( $user->roles ) ) {
					$user->add_role( 'subscriber' );
				}
			}
		}
		remove_role( self::TRANSLATOR_ROLE );
		foreach ( wp_roles()->role_objects as $role ) {
			if ( $role->has_cap( self::TRANSLATE_CAP ) ) {
				$role->remove_cap( self::TRANSLATE_CAP );
			}
		}
	}

	private static function delete_options() {
		global $wpdb;
		foreach ( self::OPTIONS as $option ) {
			delete_option( $option );
		}
		// Per-package audit results and cached wp.org lookups use dynamic names.
		foreach ( [ 'gtrans\_audit\_%', '\_transient\_gtrans\_%', '\_transient\_timeout\_gtrans\_%' ] as $like ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $like ) );
		}
	}
}

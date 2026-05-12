<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;

/**
 * Per-translation revision log.
 *
 * Each successful `TranslationLoader::save_translation()` snapshots the
 * previous row into `wp_ztrans_post_translation_revisions`. Most recent
 * MAX_REVISIONS are kept per (post, language).
 */
class TranslationHistory {

	const MAX_REVISIONS = 20;

	/**
	 * Capture the *current* row before it's overwritten. Called by the
	 * TranslationLoader right before it updates an existing translation.
	 */
	public static function snapshot_existing( $existing_row, $note = '' ) {
		if ( empty( $existing_row ) ) {
			return;
		}
		global $wpdb;
		$wpdb->insert(
			Helper::table( 'post_translation_revisions' ),
			[
				'post_id'       => (int) $existing_row['post_id'],
				'group_id'      => (int) $existing_row['group_id'],
				'language_code' => $existing_row['language_code'],
				'title'         => (string) $existing_row['title'],
				'content'       => (string) $existing_row['content'],
				'excerpt'       => (string) $existing_row['excerpt'],
				'slug'          => (string) $existing_row['slug'],
				'status'        => (string) $existing_row['status'],
				'source_hash'   => (string) $existing_row['source_hash'],
				'author_id'     => get_current_user_id(),
				'note'          => (string) $note,
				'created_at'    => Helper::get_time(),
			]
		);
		self::prune( (int) $existing_row['post_id'], $existing_row['language_code'] );
	}

	private static function prune( $post_id, $language_code ) {
		global $wpdb;
		$table = Helper::table( 'post_translation_revisions' );
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT revision_id FROM $table WHERE post_id = %d AND language_code = %s ORDER BY revision_id DESC",
				$post_id,
				$language_code
			)
		);
		if ( count( $ids ) <= self::MAX_REVISIONS ) {
			return;
		}
		$to_delete = array_slice( $ids, self::MAX_REVISIONS );
		$wpdb->query(
			"DELETE FROM $table WHERE revision_id IN (" . implode( ',', array_map( 'intval', $to_delete ) ) . ')'
		);
	}

	public static function list_for( $post_id, $language_code ) {
		global $wpdb;
		$table = Helper::table( 'post_translation_revisions' );
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT revision_id, author_id, note, created_at, source_hash, status,
				        LEFT(title, 120) AS title_preview,
				        CHAR_LENGTH(content) AS content_size
				 FROM $table
				 WHERE post_id = %d AND language_code = %s
				 ORDER BY revision_id DESC",
				(int) $post_id,
				strtolower( $language_code )
			),
			ARRAY_A
		) ?: [];
	}

	public static function get( $revision_id ) {
		global $wpdb;
		$table = Helper::table( 'post_translation_revisions' );
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE revision_id = %d", (int) $revision_id ),
			ARRAY_A
		);
	}

	public static function diff( $a_id, $b_id ) {
		$a = self::get( $a_id );
		$b = self::get( $b_id );
		if ( ! $a || ! $b ) {
			return null;
		}
		return [
			'a'      => $a,
			'b'      => $b,
			'fields' => [
				'title'   => $a['title']   !== $b['title'],
				'content' => $a['content'] !== $b['content'],
				'excerpt' => $a['excerpt'] !== $b['excerpt'],
				'slug'    => $a['slug']    !== $b['slug'],
				'status'  => $a['status']  !== $b['status'],
			],
		];
	}
}

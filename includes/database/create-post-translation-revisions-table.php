<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreatePostTranslationRevisionsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'post_translation_revisions';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			revision_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			post_id bigint(20) unsigned NOT NULL,
			group_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			title text NOT NULL,
			content longtext NOT NULL,
			excerpt text NOT NULL,
			slug varchar(255) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'draft',
			source_hash char(32) NOT NULL DEFAULT '',
			author_id bigint(20) unsigned NOT NULL DEFAULT 0,
			note varchar(255) NOT NULL DEFAULT '',
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (revision_id),
			KEY post_lang (post_id, language_code, revision_id)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

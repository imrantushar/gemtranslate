<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreatePostTranslationsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'post_translations';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			group_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			post_id bigint(20) unsigned NOT NULL DEFAULT 0,
			title text NOT NULL,
			content longtext NOT NULL,
			excerpt text NOT NULL,
			slug varchar(255) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'draft',
			source_hash char(32) NOT NULL DEFAULT '',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (group_id, language_code),
			KEY post_id (post_id),
			KEY slug_lookup (language_code, slug)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

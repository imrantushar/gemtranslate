<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreatePostMetaTranslationsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'post_meta_translations';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			post_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			meta_key varchar(255) NOT NULL,
			meta_value longtext NOT NULL,
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (post_id, language_code, meta_key(190))
		) $charset_collate;";
		dbDelta( $sql );
	}
}

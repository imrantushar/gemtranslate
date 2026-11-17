<?php
namespace GemTranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateStringTranslationsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'string_translations';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			string_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			value longtext NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'draft',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (string_id, language_code),
			KEY lang_status (language_code, status)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

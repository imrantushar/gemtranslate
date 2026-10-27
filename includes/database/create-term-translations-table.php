<?php
namespace GemTranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateTermTranslationsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'term_translations';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			group_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			term_id bigint(20) unsigned NOT NULL DEFAULT 0,
			taxonomy varchar(32) NOT NULL DEFAULT '',
			name varchar(200) NOT NULL,
			description longtext NOT NULL,
			slug varchar(200) NOT NULL DEFAULT '',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (group_id, language_code),
			KEY term_lookup (term_id, language_code),
			KEY slug_lookup (taxonomy, language_code, slug)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

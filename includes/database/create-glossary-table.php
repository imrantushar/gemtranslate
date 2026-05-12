<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateGlossaryTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'glossary';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			term_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			source_lang varchar(10) NOT NULL,
			target_lang varchar(10) NOT NULL,
			source_term varchar(255) NOT NULL,
			target_term varchar(255) NOT NULL DEFAULT '',
			case_sensitive tinyint(1) NOT NULL DEFAULT 0,
			do_not_translate tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (term_id),
			KEY lang_pair (source_lang, target_lang)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateStringsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'strings';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			string_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			domain varchar(100) NOT NULL DEFAULT '',
			context varchar(100) NOT NULL DEFAULT '',
			source text NOT NULL,
			source_hash char(32) NOT NULL,
			file_ref varchar(255) NOT NULL DEFAULT '',
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (string_id),
			UNIQUE KEY source_hash (source_hash, domain, context),
			KEY domain_idx (domain)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

<?php
namespace GemTranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateLanguagesTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'languages';
		$sql   = "CREATE TABLE $table (
			code varchar(10) NOT NULL,
			locale varchar(20) NOT NULL,
			name varchar(100) NOT NULL,
			native_name varchar(100) NOT NULL,
			flag varchar(20) NOT NULL DEFAULT '',
			is_rtl tinyint(1) NOT NULL DEFAULT 0,
			is_default tinyint(1) NOT NULL DEFAULT 0,
			active tinyint(1) NOT NULL DEFAULT 1,
			position int(11) NOT NULL DEFAULT 0,
			country_codes text NULL,
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (code),
			KEY active_position (active, position),
			KEY is_default (is_default)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

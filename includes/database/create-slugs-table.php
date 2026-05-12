<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateSlugsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'slugs';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			language_code varchar(10) NOT NULL,
			slug varchar(255) NOT NULL,
			object_type varchar(32) NOT NULL,
			group_id bigint(20) unsigned NOT NULL,
			PRIMARY KEY  (language_code, slug, object_type),
			KEY group_lookup (group_id)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

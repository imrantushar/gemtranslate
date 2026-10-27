<?php
namespace GemTranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateTranslationGroupsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'translation_groups';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			group_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			object_type varchar(32) NOT NULL,
			source_language varchar(10) NOT NULL,
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (group_id),
			KEY object_type (object_type)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

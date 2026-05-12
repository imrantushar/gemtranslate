<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateSeoMetaTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'seo_meta';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			group_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			meta_title varchar(255) NOT NULL DEFAULT '',
			meta_desc text NOT NULL,
			og_title varchar(255) NOT NULL DEFAULT '',
			og_desc text NOT NULL,
			canonical_override varchar(255) NOT NULL DEFAULT '',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (group_id, language_code)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

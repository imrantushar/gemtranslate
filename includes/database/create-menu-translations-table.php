<?php
namespace GemTranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateMenuTranslationsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'menu_translations';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			menu_item_id bigint(20) unsigned NOT NULL,
			language_code varchar(10) NOT NULL,
			title varchar(255) NOT NULL DEFAULT '',
			url_override varchar(255) NOT NULL DEFAULT '',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (menu_item_id, language_code)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

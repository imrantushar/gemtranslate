<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateTranslationMemoryTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'translation_memory';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			tm_hash char(64) NOT NULL,
			source_lang varchar(10) NOT NULL,
			target_lang varchar(10) NOT NULL,
			source longtext NOT NULL,
			target longtext NOT NULL,
			provider varchar(50) NOT NULL DEFAULT '',
			hit_count int(11) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (tm_hash),
			KEY lang_pair (source_lang, target_lang)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

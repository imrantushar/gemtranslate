<?php
namespace Zentranslate\Database;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class CreateJobsTable {
	public static function up( $prefix, $charset_collate ) {
		$table = $prefix . 'jobs';
		$sql   = "CREATE TABLE IF NOT EXISTS $table (
			job_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			type varchar(50) NOT NULL,
			payload longtext NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'pending',
			attempts int(11) NOT NULL DEFAULT 0,
			error text NOT NULL,
			scheduled_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (job_id),
			KEY status_scheduled (status, scheduled_at)
		) $charset_collate;";
		dbDelta( $sql );
	}
}

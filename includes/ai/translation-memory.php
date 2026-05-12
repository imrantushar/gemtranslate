<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;

/**
 * Translation Memory — hash(source+pair) → cached translation. Cuts duplicate
 * AI calls. Hit count and provider are tracked for visibility.
 */
class TranslationMemory {

	public static function hash( $source, $source_lang, $target_lang ) {
		return hash( 'sha256', $source . "\x1f" . strtolower( $source_lang ) . "\x1f" . strtolower( $target_lang ) );
	}

	public static function get( $source, $source_lang, $target_lang ) {
		global $wpdb;
		$h     = self::hash( $source, $source_lang, $target_lang );
		$table = Helper::table( 'translation_memory' );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE tm_hash = %s LIMIT 1", $h ),
			ARRAY_A
		);
		if ( $row ) {
			$wpdb->query( $wpdb->prepare( "UPDATE $table SET hit_count = hit_count + 1 WHERE tm_hash = %s", $h ) );
			return $row['target'];
		}
		return null;
	}

	public static function set( $source, $target, $source_lang, $target_lang, $provider = '' ) {
		global $wpdb;
		$h     = self::hash( $source, $source_lang, $target_lang );
		$table = Helper::table( 'translation_memory' );

		$exists = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE tm_hash = %s", $h ) );
		if ( $exists ) {
			return true;
		}
		return false !== $wpdb->insert(
			$table,
			[
				'tm_hash'     => $h,
				'source_lang' => strtolower( $source_lang ),
				'target_lang' => strtolower( $target_lang ),
				'source'      => $source,
				'target'      => $target,
				'provider'    => $provider,
				'hit_count'   => 0,
				'created_at'  => Helper::get_time(),
			]
		);
	}

	public static function stats() {
		global $wpdb;
		$table = Helper::table( 'translation_memory' );
		return [
			'entries' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table" ),
			'hits'    => (int) $wpdb->get_var( "SELECT COALESCE(SUM(hit_count),0) FROM $table" ),
		];
	}
}

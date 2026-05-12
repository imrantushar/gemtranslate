<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;

/**
 * Glossary — brand terms / proper nouns that should be translated consistently
 * or not translated at all (DNT).
 *
 * For DNT entries we wrap occurrences with sentinels before sending to the
 * provider, then restore them after.
 */
class Glossary {

	const SENTINEL_OPEN  = '​[[ZTG';
	const SENTINEL_CLOSE = 'ZTG]]​';

	public static function for_language_pair( $source_lang, $target_lang ) {
		global $wpdb;
		$table = Helper::table( 'glossary' );
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE source_lang = %s AND target_lang = %s",
				strtolower( $source_lang ),
				strtolower( $target_lang )
			),
			ARRAY_A
		) ?: [];
	}

	public static function add( $source_lang, $target_lang, $source_term, $target_term, $opts = [] ) {
		global $wpdb;
		return false !== $wpdb->insert(
			Helper::table( 'glossary' ),
			[
				'source_lang'      => strtolower( $source_lang ),
				'target_lang'      => strtolower( $target_lang ),
				'source_term'      => $source_term,
				'target_term'      => $target_term,
				'case_sensitive'   => ! empty( $opts['case_sensitive'] ) ? 1 : 0,
				'do_not_translate' => ! empty( $opts['do_not_translate'] ) ? 1 : 0,
				'created_at'       => Helper::get_time(),
			]
		);
	}

	public static function delete( $term_id ) {
		global $wpdb;
		return false !== $wpdb->delete( Helper::table( 'glossary' ), [ 'term_id' => (int) $term_id ] );
	}

	/**
	 * Build a context array consumable by translators.
	 */
	public static function build_context( $source_lang, $target_lang ) {
		$rows = self::for_language_pair( $source_lang, $target_lang );
		$map  = [];
		$dnt  = [];
		foreach ( $rows as $row ) {
			if ( (int) $row['do_not_translate'] === 1 ) {
				$dnt[] = $row['source_term'];
			} else {
				$map[ $row['source_term'] ] = $row['target_term'];
			}
		}
		return [
			'pairs'              => $map,
			'do_not_translate'   => $dnt,
		];
	}
}

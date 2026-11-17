<?php
namespace GemTranslate\Io;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;

/**
 * Validates a CSV that came back from an external AI model before it is
 * written, and reports what would (or did) happen row by row.
 *
 * A row is imported only when:
 *   - its id belongs to the package being imported into,
 *   - the target is not empty,
 *   - it does not already have a translation (unless overwrite is on),
 *   - and it kept every placeholder and HTML tag of the source — a lost `%s`
 *     or `<a>` would break the site, so those rows are rejected, not saved.
 */
class AiImporter {

	const MAX_ISSUES_PER_TYPE = 50;

	/**
	 * Parse model output. Tolerates the things chat models add around a CSV:
	 * a BOM, a ```csv fence, and prose before the header row.
	 *
	 * @return array<array{id:string,source:string,target:string}>
	 */
	public static function parse( $text ) {
		$text = str_replace( "\xEF\xBB\xBF", '', (string) $text );
		$text = preg_replace( '/^\s*```[a-z]*\s*$/im', '', $text );

		// Drop anything before the header line.
		if ( preg_match( '/^\s*"?id"?\s*,\s*"?source"?/im', $text, $m, PREG_OFFSET_CAPTURE ) ) {
			$text = substr( $text, $m[0][1] );
		}

		// Prose after the table ("Let me know if…") parses as a row with a
		// non-numeric id; keep only real rows.
		return array_values(
			array_filter(
				Csv::parse( trim( $text ) ),
				static function ( $row ) {
					return ctype_digit( (string) $row['id'] );
				}
			)
		);
	}

	/**
	 * @param array  $rows      Parsed CSV rows.
	 * @param string $domain    Text domain the import is scoped to.
	 * @param string $lang      Target language code.
	 * @param bool   $overwrite Replace translations that already exist.
	 * @return array{valid:array<int,string>,counts:array<string,int>,issues:array<string,array>}
	 */
	public static function analyze( array $rows, $domain, $lang, $overwrite = false ) {
		global $wpdb;
		$st  = Helper::table( 'strings' );
		$stt = Helper::table( 'string_translations' );

		$counts = [
			'rows'                 => count( $rows ),
			'ready'                => 0,
			'empty'                => 0,
			'unknown_id'           => 0,
			'already_translated'   => 0,
			'placeholder_mismatch' => 0,
			'unchanged'            => 0,
		];
		$issues = array_fill_keys( array_keys( $counts ), [] );
		unset( $issues['rows'], $issues['ready'] );

		$ids = [];
		foreach ( $rows as $r ) {
			if ( ctype_digit( (string) $r['id'] ) ) {
				$ids[] = (int) $r['id'];
			}
		}
		$known = [];
		if ( $ids ) {
			$in   = implode( ',', array_map( 'intval', array_unique( $ids ) ) );
			$data = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT s.string_id, s.source, t.value
					 FROM $st AS s
					 LEFT JOIN $stt AS t ON t.string_id = s.string_id AND t.language_code = %s
					 WHERE s.domain = %s AND s.string_id IN ($in)",
					strtolower( $lang ),
					$domain
				),
				ARRAY_A
			) ?: [];
			foreach ( $data as $d ) {
				$known[ (int) $d['string_id'] ] = $d;
			}
		}

		$valid = [];
		foreach ( $rows as $r ) {
			$raw_id = (string) $r['id'];
			$target = trim( (string) $r['target'] );

			if ( ! ctype_digit( $raw_id ) || ! isset( $known[ (int) $raw_id ] ) ) {
				self::note( $counts, $issues, 'unknown_id', $raw_id, '', '' );
				continue;
			}
			$id     = (int) $raw_id;
			$source = (string) $known[ $id ]['source'];

			if ( '' === $target ) {
				self::note( $counts, $issues, 'empty', $id, $source, '' );
				continue;
			}
			if ( ! $overwrite && '' !== (string) $known[ $id ]['value'] ) {
				self::note( $counts, $issues, 'already_translated', $id, $source, $target );
				continue;
			}
			$lost = self::lost_tokens( $source, $target );
			if ( $lost ) {
				self::note( $counts, $issues, 'placeholder_mismatch', $id, $source, $target, implode( ' ', $lost ) );
				continue;
			}
			// Still imported — "OK", brand names etc. are legitimately identical.
			if ( $target === $source && preg_match( '/\p{L}{4,}/u', $source ) ) {
				$counts['unchanged']++;
				if ( count( $issues['unchanged'] ) < self::MAX_ISSUES_PER_TYPE ) {
					$issues['unchanged'][] = [ 'id' => $id, 'source' => self::clip( $source ), 'target' => self::clip( $target ), 'detail' => '' ];
				}
			}
			$valid[ $id ] = $target;
			$counts['ready']++;
		}

		return [ 'valid' => $valid, 'counts' => $counts, 'issues' => $issues ];
	}

	private static function note( array &$counts, array &$issues, $type, $id, $source, $target, $detail = '' ) {
		$counts[ $type ]++;
		if ( count( $issues[ $type ] ) < self::MAX_ISSUES_PER_TYPE ) {
			$issues[ $type ][] = [
				'id'     => $id,
				'source' => self::clip( $source ),
				'target' => self::clip( $target ),
				'detail' => $detail,
			];
		}
	}

	/**
	 * Placeholders / tags present in the source but missing (or in a different
	 * number) in the target. Tag attributes may legitimately be translated, so
	 * tags are compared by name only.
	 *
	 * @return string[]
	 */
	public static function lost_tokens( $source, $target ) {
		$lost = [];

		$re = '/%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[bcdeEfFgGosuxX]|%%|\{\{?[^{}\s]+\}\}?|\[\/?[a-z_][a-z0-9_\-]*[^\]]*\]/i';
		preg_match_all( $re, (string) $source, $a );
		preg_match_all( $re, (string) $target, $b );
		$lost = array_merge( $lost, self::missing( $a[0], $b[0] ) );

		$tag = '/<(\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/';
		preg_match_all( $tag, (string) $source, $ta );
		preg_match_all( $tag, (string) $target, $tb );
		foreach ( self::missing( array_map( 'strtolower', $ta[1] ), array_map( 'strtolower', $tb[1] ) ) as $t ) {
			$lost[] = '<' . $t . '>';
		}
		return $lost;
	}

	/** Multiset difference: items of $need that $have does not cover. */
	private static function missing( array $need, array $have ) {
		$pool = array_count_values( $have );
		$out  = [];
		foreach ( $need as $item ) {
			if ( ! empty( $pool[ $item ] ) ) {
				$pool[ $item ]--;
			} else {
				$out[] = $item;
			}
		}
		return $out;
	}

	private static function clip( $s ) {
		$s = trim( preg_replace( '/\s+/u', ' ', (string) $s ) );
		return mb_strlen( $s ) > 100 ? mb_substr( $s, 0, 97 ) . '…' : $s;
	}
}

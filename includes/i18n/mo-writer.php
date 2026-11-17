<?php
namespace GemTranslate\I18n;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Writes a compiled `.mo` file from an array of translation pairs.
 *
 * Reference: https://www.gnu.org/software/gettext/manual/html_node/MO-Files.html
 */
class MoWriter {

	const MAGIC = 0x950412de;

	/**
	 * @param array<array{msgid:string,msgstr:string,context?:string}> $entries
	 * @param string $path Absolute file path to write.
	 * @return bool
	 */
	public static function write( array $entries, $path ) {
		// Skip empty translations.
		$pairs = [];
		foreach ( $entries as $entry ) {
			if ( '' === ( $entry['msgstr'] ?? '' ) ) {
				continue;
			}
			$context = (string) ( $entry['context'] ?? '' );
			$msgid   = '' !== $context ? $context . "\x04" . $entry['msgid'] : $entry['msgid'];
			$pairs[ $msgid ] = (string) $entry['msgstr'];
		}
		ksort( $pairs, SORT_STRING );

		// Header.
		$header_msgid  = '';
		$header_msgstr = "MIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\n";

		$keys   = array_merge( [ $header_msgid ], array_keys( $pairs ) );
		$values = array_merge( [ $header_msgstr ], array_values( $pairs ) );
		$count  = count( $keys );

		$key_offsets   = '';
		$value_offsets = '';
		$keys_block    = '';
		$values_block  = '';

		// Header is 28 bytes; each offset entry is 8 bytes (length + offset).
		$header_size      = 28;
		$index_table_size = 8 * $count;
		// Starts after header + 2 index tables.
		$keys_block_offset   = $header_size + 2 * $index_table_size;

		$keys_offsets   = [];
		$values_offsets = [];
		$cursor         = $keys_block_offset;
		foreach ( $keys as $k ) {
			$len             = strlen( $k );
			$keys_offsets[]  = [ $len, $cursor ];
			$keys_block     .= $k . "\0";
			$cursor         += $len + 1;
		}
		foreach ( $values as $v ) {
			$len             = strlen( $v );
			$values_offsets[] = [ $len, $cursor ];
			$values_block   .= $v . "\0";
			$cursor          += $len + 1;
		}

		$out = pack( 'V', self::MAGIC ); // magic
		$out .= pack( 'V', 0 );           // version
		$out .= pack( 'V', $count );      // number of strings
		$out .= pack( 'V', $header_size );                                  // offset of msgid table
		$out .= pack( 'V', $header_size + $index_table_size );              // offset of msgstr table
		$out .= pack( 'V', 0 );           // hash table size
		$out .= pack( 'V', 0 );           // hash table offset

		foreach ( $keys_offsets as $o ) {
			$out .= pack( 'V', $o[0] ) . pack( 'V', $o[1] );
		}
		foreach ( $values_offsets as $o ) {
			$out .= pack( 'V', $o[0] ) . pack( 'V', $o[1] );
		}

		$out .= $keys_block . $values_block;

		return false !== file_put_contents( $path, $out );
	}
}

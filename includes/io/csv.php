<?php
namespace GemTranslate\Io;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * CSV reader / writer for the import/export flow.
 *
 * Columns: id, source, target. UTF-8, RFC-4180 quoting.
 */
class Csv {

	/**
	 * @param array<array{id:string,source:string,target:string,note?:string}> $rows
	 */
	public static function build( $rows ) {
		$buf = fopen( 'php://temp', 'w+' );
		fputcsv( $buf, [ 'id', 'source', 'target', 'note' ] );
		foreach ( $rows as $r ) {
			fputcsv( $buf, [
				self::neutralise( (string) ( $r['id']     ?? '' ) ),
				self::neutralise( (string) ( $r['source'] ?? '' ) ),
				self::neutralise( (string) ( $r['target'] ?? '' ) ),
				self::neutralise( (string) ( $r['note']   ?? '' ) ),
			] );
		}
		rewind( $buf );
		$out = stream_get_contents( $buf );
		fclose( $buf );
		return $out;
	}

	/**
	 * @return array<array{id:string,source:string,target:string}>
	 */
	public static function parse( $text ) {
		$buf = fopen( 'php://temp', 'w+' );
		fwrite( $buf, (string) $text );
		rewind( $buf );

		$header = fgetcsv( $buf );
		if ( ! $header ) {
			fclose( $buf );
			return [];
		}
		$map = array_flip( array_map( 'strtolower', $header ) );
		$out = [];
		while ( ( $row = fgetcsv( $buf ) ) !== false ) {
			$id     = self::restore( $row[ $map['id']     ?? 0 ] ?? '' );
			$source = self::restore( $row[ $map['source'] ?? 1 ] ?? '' );
			$target = self::restore( $row[ $map['target'] ?? 2 ] ?? '' );
			if ( '' === $id ) {
				continue;
			}
			$out[] = [ 'id' => $id, 'source' => $source, 'target' => $target ];
		}
		fclose( $buf );
		return $out;
	}

	/**
	 * Spreadsheet apps run a cell as a formula when it starts with = + - @ or a
	 * tab/CR. Translated text is attacker-influenced, so export such cells with
	 * a leading apostrophe, which spreadsheets treat as "text, not a formula".
	 */
	private static function neutralise( $value ) {
		if ( '' !== $value && false !== strpos( "=+-@\t\r", $value[0] ) ) {
			return "'" . $value;
		}
		return $value;
	}

	/**
	 * Undo neutralise() on import so an export/import round trip is lossless.
	 */
	private static function restore( $value ) {
		$value = (string) $value;
		if ( strlen( $value ) > 1 && "'" === $value[0] && false !== strpos( "=+-@\t\r", $value[1] ) ) {
			return substr( $value, 1 );
		}
		return $value;
	}
}

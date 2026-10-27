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
				(string) ( $r['id']     ?? '' ),
				(string) ( $r['source'] ?? '' ),
				(string) ( $r['target'] ?? '' ),
				(string) ( $r['note']   ?? '' ),
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
			$id     = $row[ $map['id']     ?? 0 ] ?? '';
			$source = $row[ $map['source'] ?? 1 ] ?? '';
			$target = $row[ $map['target'] ?? 2 ] ?? '';
			if ( '' === $id ) {
				continue;
			}
			$out[] = [ 'id' => $id, 'source' => $source, 'target' => $target ];
		}
		fclose( $buf );
		return $out;
	}
}

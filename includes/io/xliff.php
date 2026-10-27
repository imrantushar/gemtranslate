<?php
namespace GemTranslate\Io;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Minimal XLIFF 2.1 reader / writer.
 *
 * Unit IDs encode the entity reference: `string:<id>` or
 * `post:<id>:<field>` (field = title|content|excerpt). That keeps the
 * import side simple — we know exactly what to write back.
 */
class Xliff {

	const NS = 'urn:oasis:names:tc:xliff:document:2.0';

	/**
	 * @param array<array{id:string,source:string,target:string,note?:string}> $units
	 * @return string XLIFF XML.
	 */
	public static function build( $units, $source_lang, $target_lang ) {
		$doc  = new \DOMDocument( '1.0', 'UTF-8' );
		$doc->formatOutput = true;
		$root = $doc->createElementNS( self::NS, 'xliff' );
		$root->setAttribute( 'version', '2.1' );
		$root->setAttribute( 'srcLang', $source_lang );
		$root->setAttribute( 'trgLang', $target_lang );
		$doc->appendChild( $root );

		$file = $doc->createElement( 'file' );
		$file->setAttribute( 'id', 'gemtranslate' );
		$root->appendChild( $file );

		foreach ( $units as $u ) {
			$unit = $doc->createElement( 'unit' );
			$unit->setAttribute( 'id', $u['id'] );
			if ( ! empty( $u['note'] ) ) {
				$notes = $doc->createElement( 'notes' );
				$note  = $doc->createElement( 'note', '' );
				$note->appendChild( $doc->createTextNode( (string) $u['note'] ) );
				$notes->appendChild( $note );
				$unit->appendChild( $notes );
			}
			$seg    = $doc->createElement( 'segment' );
			$source = $doc->createElement( 'source' );
			$source->appendChild( $doc->createTextNode( (string) $u['source'] ) );
			$target = $doc->createElement( 'target' );
			$target->appendChild( $doc->createTextNode( (string) $u['target'] ) );
			$seg->appendChild( $source );
			$seg->appendChild( $target );
			$unit->appendChild( $seg );
			$file->appendChild( $unit );
		}

		return $doc->saveXML();
	}

	/**
	 * @return array<array{id:string,source:string,target:string}>
	 */
	public static function parse( $xml_string ) {
		$prev = libxml_use_internal_errors( true );
		$doc  = new \DOMDocument();
		$ok   = $doc->loadXML( $xml_string );
		libxml_use_internal_errors( $prev );
		if ( ! $ok ) {
			return [];
		}
		$out = [];
		foreach ( $doc->getElementsByTagName( 'unit' ) as $unit ) {
			$id      = $unit->getAttribute( 'id' );
			$source  = '';
			$target  = '';
			foreach ( $unit->getElementsByTagName( 'segment' ) as $seg ) {
				foreach ( $seg->getElementsByTagName( 'source' ) as $s ) {
					$source = $s->textContent;
					break;
				}
				foreach ( $seg->getElementsByTagName( 'target' ) as $t ) {
					$target = $t->textContent;
					break;
				}
				break;
			}
			if ( '' === $id ) {
				continue;
			}
			$out[] = [ 'id' => $id, 'source' => $source, 'target' => $target ];
		}
		return $out;
	}
}

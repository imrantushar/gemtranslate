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
	/** Largest XLIFF document accepted, in bytes. */
	const MAX_BYTES = 5 * MB_IN_BYTES;

	public static function parse( $xml_string ) {
		$xml_string = (string) $xml_string;
		if ( '' === $xml_string || strlen( $xml_string ) > self::MAX_BYTES ) {
			return [];
		}
		// XLIFF 2.1 never needs a DTD or entity declarations. Refusing them
		// closes entity-expansion and external-entity (XXE) attacks regardless
		// of the libxml version PHP was built against.
		if ( preg_match( '/<!(DOCTYPE|ENTITY)/i', $xml_string ) ) {
			return [];
		}
		$prev_errors = libxml_use_internal_errors( true );
		// PHP < 8.0 resolves external entities unless told otherwise.
		$prev_loader = \PHP_VERSION_ID < 80000 && function_exists( 'libxml_disable_entity_loader' )
			? libxml_disable_entity_loader( true ) // phpcs:ignore PHPCompatibility.FunctionUse.RemovedFunctions
			: null;
		$doc = new \DOMDocument();
		$ok  = $doc->loadXML( $xml_string, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING );
		if ( null !== $prev_loader ) {
			libxml_disable_entity_loader( $prev_loader ); // phpcs:ignore PHPCompatibility.FunctionUse.RemovedFunctions
		}
		libxml_use_internal_errors( $prev_errors );
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

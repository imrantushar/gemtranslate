<?php
namespace Zentranslate\I18n;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Minimal `.pot` / `.po` parser. Reads `msgid` / `msgstr` pairs.
 *
 * Sufficient for our self-translate flow — we don't need full gettext
 * support (msgid_plural, comments, obsolete entries are skipped).
 */
class PotParser {

	/**
	 * @return array<array{msgid:string,msgstr:string,context:string,references:string[]}>
	 */
	public static function parse_file( $path ) {
		if ( ! is_readable( $path ) ) {
			return [];
		}
		$body = file_get_contents( $path );
		return self::parse_string( $body );
	}

	public static function parse_string( $body ) {
		$entries = [];
		$lines   = preg_split( '/\r\n|\r|\n/', (string) $body );
		$cur     = [ 'msgid' => '', 'msgstr' => '', 'context' => '', 'references' => [] ];
		$state   = null;

		foreach ( $lines as $line ) {
			$trim = trim( $line );

			if ( '' === $trim ) {
				// End of entry — flush.
				if ( '' !== $cur['msgid'] || '' !== $cur['msgstr'] ) {
					$entries[] = $cur;
				}
				$cur   = [ 'msgid' => '', 'msgstr' => '', 'context' => '', 'references' => [] ];
				$state = null;
				continue;
			}

			if ( 0 === strpos( $trim, '#:' ) ) {
				$cur['references'][] = trim( substr( $trim, 2 ) );
				continue;
			}
			if ( '#' === substr( $trim, 0, 1 ) ) {
				continue;
			}

			if ( preg_match( '/^msgctxt\s+"(.*)"$/u', $trim, $m ) ) {
				$cur['context'] = self::unescape( $m[1] );
				$state          = 'msgctxt';
				continue;
			}
			if ( preg_match( '/^msgid\s+"(.*)"$/u', $trim, $m ) ) {
				$cur['msgid'] = self::unescape( $m[1] );
				$state        = 'msgid';
				continue;
			}
			if ( preg_match( '/^msgstr\s+"(.*)"$/u', $trim, $m ) ) {
				$cur['msgstr'] = self::unescape( $m[1] );
				$state         = 'msgstr';
				continue;
			}
			if ( preg_match( '/^"(.*)"$/u', $trim, $m ) ) {
				// Continuation of previous field.
				if ( 'msgid' === $state ) {
					$cur['msgid'] .= self::unescape( $m[1] );
				} elseif ( 'msgstr' === $state ) {
					$cur['msgstr'] .= self::unescape( $m[1] );
				} elseif ( 'msgctxt' === $state ) {
					$cur['context'] .= self::unescape( $m[1] );
				}
				continue;
			}
		}

		// Last entry.
		if ( '' !== $cur['msgid'] || '' !== $cur['msgstr'] ) {
			$entries[] = $cur;
		}

		// Drop the header entry (empty msgid).
		return array_values( array_filter( $entries, fn( $e ) => '' !== $e['msgid'] ) );
	}

	private static function unescape( $s ) {
		return strtr( $s, [
			'\\n'  => "\n",
			'\\t'  => "\t",
			'\\r'  => "\r",
			'\\"'  => '"',
			'\\\\' => '\\',
		] );
	}

	public static function escape( $s ) {
		return strtr( $s, [
			'\\' => '\\\\',
			'"'  => '\\"',
			"\n" => '\\n',
			"\t" => '\\t',
			"\r" => '\\r',
		] );
	}
}

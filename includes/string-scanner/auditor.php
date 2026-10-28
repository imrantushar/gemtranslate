<?php
namespace GemTranslate\StringScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Translation-readiness audit for a plugin/theme's PHP source.
 *
 * Reports three kinds of finding, all from tokenizing — never executing — code:
 *   - missing_domain : a gettext call with no (or a non-literal) text domain
 *   - wrong_domain   : a gettext call whose domain differs from the package's
 *   - hardcoded      : user-facing text that is not wrapped in a gettext call
 *
 * The first two are exact. `hardcoded` is a heuristic (echoed strings, inline
 * HTML, well-known UI function arguments and label-style array values), so the
 * UI presents it as "likely", not certain.
 *
 * Runs in time-boxed chunks so a big plugin can be audited over several REST
 * calls without hitting max_execution_time.
 */
class Auditor {

	const TIME_BUDGET   = 12;  // seconds per chunk.
	const MAX_FILES     = 150; // files per chunk.
	const MAX_FILE_SIZE = 1048576;

	const GETTEXT = [
		'__', '_e', '_x', '_ex', '_n', '_nx',
		'esc_html__', 'esc_html_e', 'esc_html_x',
		'esc_attr__', 'esc_attr_e', 'esc_attr_x',
	];

	/** Function => argument positions that hold user-facing text. */
	const UI_FUNCS = [
		'add_menu_page'       => [ 0, 1 ],
		'add_submenu_page'    => [ 2, 3 ],
		'add_options_page'    => [ 0, 1 ],
		'add_management_page' => [ 0, 1 ],
		'add_meta_box'        => [ 1 ],
		'add_settings_section' => [ 1 ],
		'add_settings_field'  => [ 1 ],
		'add_settings_error'  => [ 2 ],
		'wp_die'              => [ 0 ],
		'printf'              => [ 0 ],
		'vprintf'             => [ 0 ],
	];

	/** Wrappers an echoed literal can sit inside and still be user-facing. */
	const PASSTHROUGH = [ 'printf', 'vprintf', 'sprintf', 'wp_kses_post', 'wp_kses' ];

	/** Array keys whose string value is displayed (labels, titles, help text). */
	const UI_KEYS = [
		'title', 'label', 'description', 'desc', 'placeholder', 'menu_name',
		'singular_name', 'add_new_item', 'button_text', 'message', 'tooltip',
		'heading', 'subtitle',
	];

	/**
	 * Audit one chunk of a package.
	 *
	 * @param string $dir    Package directory.
	 * @param string $domain Expected text domain.
	 * @param int    $offset File index to resume from.
	 * @return array{findings:array,counts:array,next_offset:int,total_files:int,done:bool}
	 */
	public static function run_chunk( $dir, $domain, $offset = 0 ) {
		$files  = FileWalker::collect_files( $dir, true, true );
		$total  = count( $files );
		$root   = trailingslashit( wp_normalize_path( $dir ) );
		$start  = microtime( true );
		$counts = [ 'missing_domain' => 0, 'wrong_domain' => 0, 'hardcoded' => 0, 'calls' => 0 ];
		$all    = [];
		$i      = max( 0, (int) $offset );
		$done_in_chunk = 0;

		for ( ; $i < $total; $i++ ) {
			if ( $done_in_chunk >= self::MAX_FILES || ( microtime( true ) - $start ) > self::TIME_BUDGET ) {
				break;
			}
			$path = $files[ $i ];
			if ( filesize( $path ) > self::MAX_FILE_SIZE ) {
				continue;
			}
			$code = @file_get_contents( $path );
			if ( false === $code ) {
				continue;
			}
			$done_in_chunk++;
			$rel = ltrim( str_replace( $root, '', wp_normalize_path( $path ) ), '/' );

			$result = self::audit_code( $code, $domain );
			$counts['calls'] += $result['calls'];
			foreach ( $result['findings'] as $f ) {
				$counts[ $f['type'] ]++;
				$f['file'] = $rel;
				$all[]     = $f;
			}
		}

		return [
			'findings'    => $all,
			'counts'      => $counts,
			'next_offset' => $i,
			'total_files' => $total,
			'done'        => $i >= $total,
		];
	}

	/**
	 * Audit a single PHP source string.
	 *
	 * @return array{findings:array<array{type:string,line:int,text:string,found:string}>,calls:int}
	 */
	public static function audit_code( $code, $domain ) {
		$findings = [];

		// 1. Domain checks — exact.
		$calls = CallExtractor::extract( $code );
		foreach ( $calls as $call ) {
			if ( '' === $call['text'] ) {
				continue;
			}
			if ( '' === $call['domain'] ) {
				$findings[] = self::finding( 'missing_domain', $call['line'], $call['text'], '' );
			} elseif ( $call['domain'] !== $domain ) {
				$findings[] = self::finding( 'wrong_domain', $call['line'], $call['text'], $call['domain'] );
			}
		}

		// 2. Hardcoded text — heuristic.
		foreach ( self::find_hardcoded( $code ) as $hit ) {
			$findings[] = self::finding( 'hardcoded', $hit['line'], $hit['text'], '' );
		}

		return [ 'findings' => $findings, 'calls' => count( $calls ) ];
	}

	private static function finding( $type, $line, $text, $found ) {
		return [
			'type'  => $type,
			'line'  => (int) $line,
			'text'  => self::clip( $text ),
			'found' => (string) $found,
		];
	}

	private static function clip( $s ) {
		$s = trim( preg_replace( '/\s+/u', ' ', (string) $s ) );
		return mb_strlen( $s ) > 120 ? mb_substr( $s, 0, 117 ) . '…' : $s;
	}

	/**
	 * Walk the token stream looking for display text outside gettext calls.
	 *
	 * @return array<array{line:int,text:string}>
	 */
	private static function find_hardcoded( $code ) {
		$tokens = @token_get_all( $code );
		if ( ! is_array( $tokens ) ) {
			return [];
		}

		$hits   = [];
		$stack  = []; // one frame per open ( or [ : [ 'kind' => gettext|ui|pass|other|array, 'fn' => name, 'arg' => int ]
		$echo   = false;
		$prev   = null; // previous significant token (array or char).
		$prev2  = null;
		$n      = count( $tokens );

		for ( $i = 0; $i < $n; $i++ ) {
			$t = $tokens[ $i ];

			if ( is_array( $t ) ) {
				$id = $t[0];
				if ( T_WHITESPACE === $id || T_COMMENT === $id || T_DOC_COMMENT === $id ) {
					continue;
				}

				if ( T_ECHO === $id || T_PRINT === $id || T_OPEN_TAG_WITH_ECHO === $id ) {
					$echo = true;
				} elseif ( T_CLOSE_TAG === $id ) {
					$echo = false;
				} elseif ( T_INLINE_HTML === $id ) {
					foreach ( self::fragments( $t[1] ) as $frag ) {
						$hits[] = [ 'line' => $t[2] + self::lines_before( $t[1], $frag ), 'text' => $frag ];
					}
				} elseif ( T_CONSTANT_ENCAPSED_STRING === $id || T_ENCAPSED_AND_WHITESPACE === $id ) {
					$raw = T_CONSTANT_ENCAPSED_STRING === $id ? self::unquote( $t[1] ) : $t[1];
					if ( self::is_display_context( $stack, $echo, $prev, $prev2 ) ) {
						foreach ( self::fragments( $raw ) as $frag ) {
							$hits[] = [ 'line' => $t[2], 'text' => $frag ];
						}
					}
				}

				$prev2 = $prev;
				$prev  = $t;
				continue;
			}

			// Single-character tokens.
			if ( '(' === $t ) {
				$fn   = ( is_array( $prev ) && T_STRING === $prev[0] ) ? $prev[1] : '';
				$kind = 'other';
				if ( '' !== $fn ) {
					if ( in_array( $fn, self::GETTEXT, true ) ) {
						$kind = 'gettext';
					} elseif ( isset( self::UI_FUNCS[ $fn ] ) ) {
						$kind = 'ui';
					} elseif ( in_array( $fn, self::PASSTHROUGH, true ) ) {
						$kind = 'pass';
					}
				}
				$stack[] = [ 'kind' => $kind, 'fn' => $fn, 'arg' => 0 ];
			} elseif ( '[' === $t ) {
				$stack[] = [ 'kind' => 'array', 'fn' => '', 'arg' => 0 ];
			} elseif ( ')' === $t || ']' === $t ) {
				array_pop( $stack );
			} elseif ( ',' === $t && $stack ) {
				$stack[ count( $stack ) - 1 ]['arg']++;
			} elseif ( ';' === $t ) {
				$echo  = false;
				$stack = [];
			}

			$prev2 = $prev;
			$prev  = $t;
		}

		return $hits;
	}

	/** Decide whether a string literal at this position is shown to a user. */
	private static function is_display_context( array $stack, $echo, $prev, $prev2 ) {
		foreach ( $stack as $frame ) {
			// Already inside __(), esc_html__() …: not hardcoded.
			if ( 'gettext' === $frame['kind'] ) {
				return false;
			}
		}

		$top = $stack ? $stack[ count( $stack ) - 1 ] : null;

		// Argument of a function that is known to display its text.
		if ( $top && 'ui' === $top['kind'] && in_array( $top['arg'], self::UI_FUNCS[ $top['fn'] ], true ) ) {
			return true;
		}

		// 'label' => 'Some text' inside an array.
		if ( $top && 'array' === $top['kind'] && is_array( $prev ) && T_DOUBLE_ARROW === $prev[0]
			&& is_array( $prev2 ) && T_CONSTANT_ENCAPSED_STRING === $prev2[0]
			&& in_array( self::unquote( $prev2[1] ), self::UI_KEYS, true ) ) {
			return true;
		}

		// echo / print 'text' — directly, or through printf-style wrappers.
		if ( $echo ) {
			foreach ( $stack as $frame ) {
				if ( ! in_array( $frame['kind'], [ 'pass', 'ui' ], true ) ) {
					return false;
				}
			}
			return true;
		}

		return false;
	}

	/**
	 * Pull human-readable text fragments out of a (possibly HTML) string:
	 * visible text between tags, plus placeholder/title/alt/aria-label values.
	 *
	 * @return string[]
	 */
	private static function fragments( $str ) {
		$str = (string) $str;
		if ( '' === trim( $str ) ) {
			return [];
		}
		$out = [];

		if ( preg_match_all( '/\b(?:placeholder|title|alt|aria-label)\s*=\s*(["\'])(.*?)\1/is', $str, $m ) ) {
			foreach ( $m[2] as $attr ) {
				if ( self::looks_like_text( $attr ) ) {
					$out[] = trim( $attr );
				}
			}
		}

		$body = preg_replace( '#<(script|style)\b.*?</\1>#is', '', $str );
		// A PHP tag can split an HTML tag in two; drop the dangling halves
		// (`<img src="` before the PHP, `" alt="">` after it).
		$body = preg_replace( [ '/<[^>]*$/', '/^[^<>]*>/' ], '', $body );
		foreach ( preg_split( '/<[^>]*>/', $body ) as $piece ) {
			if ( self::looks_like_text( $piece ) ) {
				$out[] = trim( html_entity_decode( $piece ) );
			}
		}
		return $out;
	}

	/** Reject slugs, paths, CSS, code and other non-prose strings. */
	private static function looks_like_text( $s ) {
		$s = trim( preg_replace( '/\s+/u', ' ', html_entity_decode( (string) $s ) ) );
		if ( mb_strlen( $s ) < 3 ) {
			return false;
		}
		if ( ! preg_match( '/\p{L}{3,}/u', $s ) ) {
			return false;
		}
		if ( preg_match( '~^(https?:|/|#|\.|\$|%|\{)~i', $s ) ) {
			return false;
		}
		if ( preg_match( '/[{};]|=>|->|::|\\\\/', $s ) ) {
			return false;
		}
		// slug / key / file-like: lowercase, no spaces.
		if ( preg_match( '/^[a-z0-9_\-:\/\.\[\]]+$/', $s ) ) {
			return false;
		}
		// A single word must read like a label ("Settings", "Save:"), not a token.
		if ( false === strpos( $s, ' ' ) && ! preg_match( '/^\p{Lu}\p{Ll}{2,}[:.!?…]*$/u', $s ) ) {
			return false;
		}
		return true;
	}

	private static function lines_before( $haystack, $needle ) {
		$pos = strpos( $haystack, $needle );
		return false === $pos ? 0 : substr_count( substr( $haystack, 0, $pos ), "\n" );
	}

	private static function unquote( $literal ) {
		$literal = (string) $literal;
		if ( strlen( $literal ) < 2 ) {
			return $literal;
		}
		return substr( $literal, 1, -1 );
	}
}

<?php
namespace Zentranslate\StringScanner;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Extracts gettext-family calls from a PHP file by tokenizing — never
 * by executing the file. Patterns matched:
 *   __( 'text', 'domain' )
 *   _e( 'text', 'domain' )
 *   esc_html__( 'text', 'domain' )
 *   esc_attr__( 'text', 'domain' )
 *   _x( 'text', 'context', 'domain' )
 *   _ex( 'text', 'context', 'domain' )
 *   esc_html_x( 'text', 'context', 'domain' )
 *   _n( 'single', 'plural', $n, 'domain' )
 */
class CallExtractor {

	const SIMPLE_FUNCS = [
		'__'           => [ 'text' => 0, 'domain' => 1 ],
		'_e'           => [ 'text' => 0, 'domain' => 1 ],
		'esc_html__'   => [ 'text' => 0, 'domain' => 1 ],
		'esc_html_e'   => [ 'text' => 0, 'domain' => 1 ],
		'esc_attr__'   => [ 'text' => 0, 'domain' => 1 ],
		'esc_attr_e'   => [ 'text' => 0, 'domain' => 1 ],
		'_x'           => [ 'text' => 0, 'context' => 1, 'domain' => 2 ],
		'_ex'          => [ 'text' => 0, 'context' => 1, 'domain' => 2 ],
		'esc_html_x'   => [ 'text' => 0, 'context' => 1, 'domain' => 2 ],
		'esc_attr_x'   => [ 'text' => 0, 'context' => 1, 'domain' => 2 ],
	];

	/**
	 * Extract gettext calls from a file's source code.
	 *
	 * @param string $code File contents.
	 * @return array<array{text:string,domain:string,context:string,line:int}>
	 */
	public static function extract( $code ) {
		$tokens = @token_get_all( $code );
		if ( ! is_array( $tokens ) ) {
			return [];
		}
		$out = [];

		for ( $i = 0, $n = count( $tokens ); $i < $n; $i++ ) {
			$t = $tokens[ $i ];
			if ( ! is_array( $t ) || T_STRING !== $t[0] ) {
				continue;
			}
			$name = $t[1];
			if ( ! isset( self::SIMPLE_FUNCS[ $name ] ) ) {
				continue;
			}
			// Next non-whitespace must be `(`.
			$j = self::next_non_ws( $tokens, $i + 1 );
			if ( $j === null || $tokens[ $j ] !== '(' ) {
				continue;
			}
			$args   = self::collect_args( $tokens, $j + 1 );
			$config = self::SIMPLE_FUNCS[ $name ];
			$text   = $args[ $config['text'] ] ?? null;
			if ( null === $text ) {
				continue;
			}
			$context = isset( $config['context'] ) ? ( $args[ $config['context'] ] ?? '' ) : '';
			$domain  = isset( $config['domain'] ) ? ( $args[ $config['domain'] ] ?? '' ) : '';
			$out[] = [
				'text'    => $text,
				'context' => $context,
				'domain'  => $domain,
				'line'    => $t[2],
			];
		}
		return $out;
	}

	private static function next_non_ws( $tokens, $start ) {
		for ( $i = $start, $n = count( $tokens ); $i < $n; $i++ ) {
			$t = $tokens[ $i ];
			if ( is_array( $t ) && in_array( $t[0], [ T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ], true ) ) {
				continue;
			}
			return $i;
		}
		return null;
	}

	/**
	 * Read up to the matching `)`, return literal string args by position.
	 * Skips non-string args (variables, function calls — they can't be statically extracted).
	 *
	 * @return array<int,string>
	 */
	private static function collect_args( $tokens, $start ) {
		$args        = [];
		$current_arg = '';
		$has_value   = false;
		$depth       = 1;
		for ( $i = $start, $n = count( $tokens ); $i < $n; $i++ ) {
			$t = $tokens[ $i ];
			if ( '(' === $t ) {
				$depth++;
				continue;
			}
			if ( ')' === $t ) {
				$depth--;
				if ( 0 === $depth ) {
					if ( $has_value ) {
						$args[] = $current_arg;
					}
					return $args;
				}
				continue;
			}
			if ( ',' === $t && 1 === $depth ) {
				$args[]      = $has_value ? $current_arg : null;
				$current_arg = '';
				$has_value   = false;
				continue;
			}
			if ( is_array( $t ) && T_CONSTANT_ENCAPSED_STRING === $t[0] ) {
				$current_arg = self::dequote( $t[1] );
				$has_value   = true;
			}
		}
		return $args;
	}

	private static function dequote( $literal ) {
		if ( strlen( $literal ) < 2 ) {
			return $literal;
		}
		$quote = $literal[0];
		$inner = substr( $literal, 1, -1 );
		if ( "'" === $quote ) {
			return strtr( $inner, [ "\\'" => "'", '\\\\' => '\\' ] );
		}
		// Double-quoted — minimal unescaping.
		return strtr( $inner, [ '\\"' => '"', '\\\\' => '\\', '\\n' => "\n", '\\t' => "\t" ] );
	}
}

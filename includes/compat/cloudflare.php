<?php
namespace Zentranslate\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Cloudflare bridge. With subdirectory URLs, the edge cache treats each
 * language URL as distinct automatically. We add Vary headers as belt-and-
 * suspenders for any redirects served from PHP.
 */
class Cloudflare {

	public static function init() {
		add_filter( 'wp_headers', [ __CLASS__, 'add_vary' ] );
	}

	public static function add_vary( $headers ) {
		$existing = $headers['Vary'] ?? '';
		$pieces   = array_filter( array_map( 'trim', explode( ',', $existing ) ) );
		if ( ! in_array( 'Cookie', $pieces, true ) ) {
			$pieces[] = 'Cookie';
		}
		$headers['Vary'] = implode( ', ', $pieces );
		return $headers;
	}
}

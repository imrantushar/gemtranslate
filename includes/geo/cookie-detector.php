<?php
namespace GemTranslate\Geo;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the `gtrans_user_country` cookie. Acts as both a fallback (when no
 * server-side detector is available) and a manual override — the visitor's
 * choice in the country picker banner is written to this cookie.
 */
class CookieDetector implements Detector {

	private $cookie_name;

	public function __construct( $cookie_name ) {
		$this->cookie_name = (string) $cookie_name;
	}

	public function detect() {
		$raw = isset( $_COOKIE[ $this->cookie_name ] )
			? strtoupper( (string) $_COOKIE[ $this->cookie_name ] )
			: '';
		return preg_match( '/^[A-Z]{2}$/', $raw ) ? $raw : '';
	}
}

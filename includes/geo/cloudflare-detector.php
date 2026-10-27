<?php
namespace GemTranslate\Geo;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the `CF-IPCountry` header injected by CloudFlare on every request that
 * passes through their edge. Zero-config when the site is behind CloudFlare;
 * returns '' otherwise.
 *
 * CloudFlare uses 'XX' to mean "unknown" and 'T1' for Tor — both treated as
 * empty so the chain falls through to the next detector.
 */
class CloudflareDetector implements Detector {

	public function detect() {
		$iso = strtoupper( trim( (string) ( $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '' ) ) );
		if ( '' === $iso || 'XX' === $iso || 'T1' === $iso ) {
			return '';
		}
		return preg_match( '/^[A-Z]{2}$/', $iso ) ? $iso : '';
	}
}

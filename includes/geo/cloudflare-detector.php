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
		// Any client can send this header to an origin it can reach directly;
		// only trust it when the connection really came through a proxy.
		if ( ! TrustedProxy::is_trusted_peer() ) {
			return '';
		}
		$iso = strtoupper( trim( (string) ( $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '' ) ) );
		if ( '' === $iso || 'XX' === $iso || 'T1' === $iso ) {
			return '';
		}
		return preg_match( '/^[A-Z]{2}$/', $iso ) ? $iso : '';
	}
}

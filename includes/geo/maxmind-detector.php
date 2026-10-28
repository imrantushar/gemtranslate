<?php
namespace GemTranslate\Geo;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Looks up the visitor's IP in a local MaxMind GeoLite2-Country DB. Requires
 * the official `geoip2/geoip2` Composer package OR the lightweight
 * `maxmind-db/reader` package to be available on the autoload path.
 *
 * When neither package nor the DB file is present, returns '' so the chain
 * falls through to the next configured detector.
 */
class MaxmindDetector implements Detector {

	private $db_path;

	public function __construct( $db_path ) {
		$this->db_path = (string) $db_path;
	}

	public function detect() {
		if ( '' === $this->db_path || ! is_readable( $this->db_path ) ) {
			return '';
		}
		$ip = $this->visitor_ip();
		if ( '' === $ip ) {
			return '';
		}

		try {
			if ( class_exists( '\\GeoIp2\\Database\\Reader' ) ) {
				$reader = new \GeoIp2\Database\Reader( $this->db_path );
				$record = $reader->country( $ip );
				$iso    = $record->country->isoCode ?? '';
			} elseif ( class_exists( '\\MaxMind\\Db\\Reader' ) ) {
				$reader = new \MaxMind\Db\Reader( $this->db_path );
				$record = $reader->get( $ip );
				$iso    = $record['country']['iso_code'] ?? '';
			} else {
				return '';
			}
		} catch ( \Throwable $e ) {
			return '';
		}

		$iso = strtoupper( (string) $iso );
		return preg_match( '/^[A-Z]{2}$/', $iso ) ? $iso : '';
	}

	private function visitor_ip() {
		// Forwarded headers are only believed from a trusted proxy.
		return TrustedProxy::client_ip();
	}
}

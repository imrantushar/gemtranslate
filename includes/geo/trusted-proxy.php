<?php
namespace GemTranslate\Geo;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\CountryContext;

/**
 * Decides whether proxy-supplied headers (`CF-Connecting-IP`, `CF-IPCountry`,
 * `X-Forwarded-For`, `X-Real-IP`) can be believed for this request.
 *
 * Those headers are ordinary request headers: anyone who can reach the origin
 * can send them with any value. They are only meaningful when the TCP peer
 * (`REMOTE_ADDR`) is a proxy we trust, so geo detection must check that first.
 *
 * Trusted peers: Cloudflare's published ranges by default, plus anything in
 * the `geo_trusted_proxies` setting (array or comma/newline-separated CIDRs)
 * and the `gtrans_trusted_proxies` filter. Sites behind another reverse proxy
 * or load balancer add that proxy's address or CIDR there.
 *
 * When the server rewrites REMOTE_ADDR to the visitor's IP (real-IP module),
 * no range can match; the `geo_trust_proxy_headers` setting then trusts the
 * headers outright. Only enable it when the origin cannot be reached directly.
 */
class TrustedProxy {

	/**
	 * Cloudflare edge ranges (https://www.cloudflare.com/ips/).
	 */
	const CLOUDFLARE = [
		'173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
		'141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
		'197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
		'104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
		'2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
		'2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
	];

	/**
	 * Is the connecting peer a proxy whose forwarded headers we trust?
	 */
	public static function is_trusted_peer() {
		// The web server (LiteSpeed/nginx/Apache real-IP module) often rewrites
		// REMOTE_ADDR to the visitor's IP, so the peer is never a proxy range
		// even though the site really is behind Cloudflare. The admin can state
		// that the origin is only reachable through the proxy.
		if ( ! empty( CountryContext::settings()['geo_trust_proxy_headers'] ) ) {
			return true;
		}
		$peer = (string) ( $_SERVER['REMOTE_ADDR'] ?? '' );
		if ( '' === $peer || ! filter_var( $peer, FILTER_VALIDATE_IP ) ) {
			return false;
		}
		foreach ( self::trusted_ranges() as $range ) {
			if ( self::in_range( $peer, $range ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Best-known client IP. Forwarded headers are consulted only when the peer
	 * is trusted; otherwise this is simply REMOTE_ADDR.
	 */
	public static function client_ip() {
		$peer = (string) ( $_SERVER['REMOTE_ADDR'] ?? '' );
		if ( self::is_trusted_peer() ) {
			$candidates = [
				$_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
				$_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
				$_SERVER['HTTP_X_REAL_IP'] ?? '',
			];
			foreach ( $candidates as $value ) {
				// XFF may be a chain; the first entry is the original client.
				$first = trim( explode( ',', (string) $value )[0] );
				if ( '' !== $first && filter_var( $first, FILTER_VALIDATE_IP ) ) {
					return $first;
				}
			}
		}
		return filter_var( $peer, FILTER_VALIDATE_IP ) ? $peer : '';
	}

	/**
	 * @return string[] CIDR ranges or single addresses.
	 */
	public static function trusted_ranges() {
		$ranges = self::CLOUDFLARE;
		$extra  = CountryContext::settings()['geo_trusted_proxies'] ?? [];
		if ( is_string( $extra ) ) {
			$extra = preg_split( '/[\s,]+/', $extra, -1, PREG_SPLIT_NO_EMPTY );
		}
		if ( is_array( $extra ) ) {
			$ranges = array_merge( $ranges, array_map( 'strval', $extra ) );
		}
		$ranges = apply_filters( 'gtrans_trusted_proxies', $ranges );
		return is_array( $ranges ) ? $ranges : self::CLOUDFLARE;
	}

	/**
	 * Is $ip inside $range ("a.b.c.d/nn", "x::/nn", or a bare address)?
	 */
	public static function in_range( $ip, $range ) {
		$range = trim( (string) $range );
		if ( '' === $range ) {
			return false;
		}
		$parts = explode( '/', $range, 2 );
		$net   = @inet_pton( $parts[0] );
		$addr  = @inet_pton( (string) $ip );
		if ( false === $net || false === $addr || strlen( $net ) !== strlen( $addr ) ) {
			return false; // Invalid input or IPv4 vs IPv6 mismatch.
		}
		$max  = strlen( $net ) * 8;
		$bits = isset( $parts[1] ) && ctype_digit( $parts[1] ) ? min( (int) $parts[1], $max ) : $max;

		$full = intdiv( $bits, 8 );
		if ( $full && 0 !== substr_compare( $net, $addr, 0, $full ) ) {
			return false;
		}
		$rest = $bits % 8;
		if ( 0 === $rest ) {
			return true;
		}
		$mask = ( 0xFF << ( 8 - $rest ) ) & 0xFF;
		return ( ord( $net[ $full ] ) & $mask ) === ( ord( $addr[ $full ] ) & $mask );
	}
}

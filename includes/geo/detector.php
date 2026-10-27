<?php
namespace GemTranslate\Geo;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A geo source. Each implementation returns an ISO 3166-1 alpha-2 country
 * code, or an empty string when it can't decide. CountryContext walks an
 * ordered list of these and takes the first non-empty answer.
 */
interface Detector {
	/**
	 * @return string ISO code or ''.
	 */
	public function detect();
}

<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Geo subsystem dispatcher. Currently has no init hooks of its own — the
 * detectors are pure classes consumed by CountryContext. Kept as a sibling of
 * Translation / Routing / Language for symmetry and future expansion (e.g.,
 * an admin notice when MaxMind is selected but the package is missing).
 */
class Geo {
	public static function init() {
		// Reserved.
	}
}

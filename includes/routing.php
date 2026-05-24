<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Routing {
	public static function init() {
		Routing\RequestParser::init();
		Routing\UrlRewriter::init();
		// CountryRedirector runs at template_redirect priority 0 (before
		// BrowserRedirect at priority 1) so country-based decisions win when
		// both signals are configured.
		Routing\CountryRedirector::init();
		Routing\BrowserRedirect::init();
	}
}

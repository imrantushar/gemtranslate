<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Routing {
	public static function init() {
		Routing\RequestParser::init();
		Routing\UrlRewriter::init();
		Routing\BrowserRedirect::init();
	}
}

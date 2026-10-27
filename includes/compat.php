<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Compat {
	public static function init() {
		// WooCommerce translation is Pro. Cache-plugin compatibility is free.
		Compat\WpRocket::init();
		Compat\W3TC::init();
		Compat\LiteSpeed::init();
		Compat\Cloudflare::init();
	}
}

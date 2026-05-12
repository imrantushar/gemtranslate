<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Compat {
	public static function init() {
		Compat\WooCommerce::init();
		Compat\WpRocket::init();
		Compat\W3TC::init();
		Compat\LiteSpeed::init();
		Compat\Cloudflare::init();
	}
}

<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cache {
	public static function init() {
		Cache\Invalidator::init();
	}
}

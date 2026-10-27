<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cache {
	public static function init() {
		Cache\Invalidator::init();
	}
}

<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin {
	public static function init() {
		Admin\AdminMenu::init();
	}
}

<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin {
	public static function init() {
		Admin\Localizer::init();
		Admin\AdminMenu::init();
		Admin\ProfileField::init();
		Admin\AdminBar::init();
	}
}

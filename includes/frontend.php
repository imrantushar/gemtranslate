<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Frontend {
	public static function init() {
		Frontend\LanguageSwitcher::init();
		Frontend\LanguageSwitcherBlock::init();
		Frontend\LanguageSwitcherWidget::init();
	}
}

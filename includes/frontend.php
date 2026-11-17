<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Frontend {
	public static function init() {
		Frontend\LanguageSwitcher::init();
		Frontend\LanguageSwitcherBlock::init();
		Frontend\LanguageSwitcherWidget::init();
		Frontend\FloatingSwitcher::init();
		Frontend\Shortcodes::init();
	}
}

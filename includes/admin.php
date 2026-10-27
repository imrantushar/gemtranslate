<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin {
	public static function init() {
		Admin\Localizer::init();
		Admin\AdminMenu::init();
		Admin\ProfileField::init();
		Admin\AdminBar::init();
		// MailLocalizer (transactional email locale switch) is Pro.
	}
}

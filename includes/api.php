<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class API {
	public static function init() {
		API\Languages::init();
		API\PostTranslations::init();
		API\TermTranslations::init();
		API\Menus::init();
		API\Strings::init();
		API\SEO::init();
		API\AI::init();
		API\Jobs::init();
		API\Settings::init();
		API\Stats::init();
	}
}

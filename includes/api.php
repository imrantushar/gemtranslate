<?php
namespace GemTranslate;

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
		API\Migration::init();
		API\Settings::init();
		API\Stats::init();
		API\Geo::init();
		// Pro API controllers (SEO meta, Jobs, Translators, Revisions, Import/Export)
		// are registered by gemtranslate-pro on `gtrans_init`.
	}
}

<?php
namespace GemTranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Translation {
	public static function init() {
		Translation\PostTranslator::init();
		Translation\TermTranslator::init();
		Translation\MenuTranslator::init();
		Translation\StringTranslator::init();
		Translation\LayoutTranslator::init();
		Translation\LayoutVariants::init();
		Translation\ShadowPostSync::init();
		Translation\ElementorTranslator::init();
		// MetaTranslator (custom fields/ACF) is Pro — registered by gemtranslate-pro on `gtrans_init`.
	}
}

<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Translation {
	public static function init() {
		Translation\PostTranslator::init();
		Translation\TermTranslator::init();
		Translation\MenuTranslator::init();
		Translation\StringTranslator::init();
		Translation\MetaTranslator::init();
		Translation\ShadowPostSync::init();
	}
}

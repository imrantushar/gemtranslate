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
		Translation\ShadowPostSync::init();
		// MetaTranslator (custom fields/ACF) and AutoTranslate (Translate
		// Everything) are Pro — registered by zentranslate-pro on `ztrans_init`.
	}
}

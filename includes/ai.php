<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AI {
	public static function init() {
		// The provider layer (TranslatorFactory + translators) lives in free for
		// the per-field "AI taste". The async job runner, translation memory, and
		// glossary are Pro (zentranslate-pro) and self-register on `ztrans_init`.
	}
}

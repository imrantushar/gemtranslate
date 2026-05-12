<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AI {
	public static function init() {
		AI\JobRunner::init();
	}
}

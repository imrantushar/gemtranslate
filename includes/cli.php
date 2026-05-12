<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cli {
	public static function init() {
		if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
			return;
		}
		Cli\Command::register();
	}
}

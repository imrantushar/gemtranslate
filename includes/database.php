<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Database {

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'maybe_flush_rewrite_rules' ], 6 );
	}

	public function maybe_flush_rewrite_rules() {
		if ( 'yes' === get_option( 'ztrans_required_rewrite_flush' ) ) {
			update_option( 'ztrans_required_rewrite_flush', 'no' );
			flush_rewrite_rules();
		}
	}
}

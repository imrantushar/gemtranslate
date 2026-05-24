<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Database {

	public static function init() {
		$self = new self();
		add_action( 'init', [ $self, 'maybe_flush_rewrite_rules' ], 6 );
		// Run dbDelta on init when the stored schema version is behind the
		// constant. Idempotent — no-ops when versions match.
		add_action( 'init', [ Database\Migrator::class, 'maybe_upgrade' ], 5 );
	}

	public function maybe_flush_rewrite_rules() {
		if ( 'yes' === get_option( 'ztrans_required_rewrite_flush' ) ) {
			update_option( 'ztrans_required_rewrite_flush', 'no' );
			flush_rewrite_rules();
		}
	}
}

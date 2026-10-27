<?php
namespace GemTranslate;

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
		if ( 'yes' === Helper::meta_get( 'required_rewrite_flush' ) ) {
			Helper::meta_set( 'required_rewrite_flush', 'no' );
			flush_rewrite_rules();
		}
	}
}

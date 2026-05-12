<?php
namespace Zentranslate\Migration;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lightweight result aggregator for importers. Each importer accumulates
 * counts and notes; the REST controller returns this verbatim.
 */
class MigrationResult {

	public $source       = '';
	public $languages    = 0;
	public $posts        = 0;
	public $terms        = 0;
	public $strings      = 0;
	public $skipped      = 0;
	public $errors       = [];
	public $detected     = false;

	public function __construct( $source ) {
		$this->source = $source;
	}

	public function to_array() {
		return [
			'source'    => $this->source,
			'detected'  => $this->detected,
			'languages' => $this->languages,
			'posts'     => $this->posts,
			'terms'     => $this->terms,
			'strings'   => $this->strings,
			'skipped'   => $this->skipped,
			'errors'    => $this->errors,
		];
	}
}

<?php
namespace GemTranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Interface every AI translation provider must implement.
 */
interface TranslatorInterface {

	/**
	 * Translate a single text or an array of texts.
	 *
	 * @param string|array $texts
	 * @param string $source_lang Source language code (e.g., "en").
	 * @param string $target_lang Target language code.
	 * @param array  $context     Optional: ['preserve_html' => bool, 'glossary' => array, ...]
	 * @return array|\WP_Error {
	 *     'translations' => string[]   // same length as input
	 *     'provider'     => string
	 *     'model'        => string|null
	 * }
	 */
	public function translate( $texts, $source_lang, $target_lang, $context = [] );

	/**
	 * Validate that credentials work. Used by the "Test" button in admin.
	 *
	 * @return true|\WP_Error
	 */
	public function test_credentials();

	/**
	 * Provider identifier (e.g., "openai", "deepl", "google").
	 */
	public function name();
}

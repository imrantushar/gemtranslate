<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * OpenAI Chat Completions translator.
 *
 * Uses a strict system prompt that asks for translation only, preserving
 * HTML/markdown structure. Returns texts in the original order via a
 * delimiter-separated payload.
 */
class OpenAiTranslator implements TranslatorInterface {

	const ENDPOINT     = 'https://api.openai.com/v1/chat/completions';
	const DELIMITER    = "\n%%%ZTRANS_SPLIT%%%\n";
	const DEFAULT_MODEL = 'gpt-4o-mini';

	private $api_key;
	private $model;

	public function __construct( $api_key = '', $model = '' ) {
		$this->api_key = $api_key;
		$this->model   = $model ?: self::DEFAULT_MODEL;
	}

	public function name() {
		return 'openai';
	}

	public function translate( $texts, $source_lang, $target_lang, $context = [] ) {
		if ( empty( $this->api_key ) ) {
			return new \WP_Error( 'ztrans_no_key', __( 'OpenAI API key is not configured.', 'zentranslate' ) );
		}

		$is_array = is_array( $texts );
		$batch    = $is_array ? array_values( $texts ) : [ (string) $texts ];

		if ( empty( $batch ) ) {
			return [ 'translations' => [], 'provider' => $this->name(), 'model' => $this->model ];
		}

		$preserve_html = ! empty( $context['preserve_html'] );
		$payload       = implode( self::DELIMITER, $batch );

		$system  = sprintf(
			"You are a professional translator. Translate the user content from %s to %s.\n" .
			"Rules:\n" .
			"- Return ONLY the translation, no commentary.\n" .
			"- If the input contains multiple segments separated by the delimiter %s, return the same number of segments using the same delimiter.\n" .
			"- Preserve the order of segments.\n" .
			"%s" .
			"- Do not translate code blocks, URLs, email addresses, or shortcodes.\n" .
			"- Preserve placeholders like %%s, %%d, {variables}, [shortcodes], <html_tags>.",
			$this->language_label( $source_lang ),
			$this->language_label( $target_lang ),
			trim( self::DELIMITER ),
			$preserve_html ? "- Preserve HTML/markdown structure and attributes exactly.\n" : ''
		);

		if ( ! empty( $context['glossary'] ) ) {
			$system .= "\nGlossary (apply consistently):\n";
			foreach ( $context['glossary'] as $term => $translation ) {
				$system .= "- \"$term\" -> \"$translation\"\n";
			}
		}

		$response = wp_remote_post(
			self::ENDPOINT,
			[
				'timeout' => 60,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
				],
				'body'    => wp_json_encode(
					[
						'model'       => $this->model,
						'temperature' => 0.2,
						'messages'    => [
							[ 'role' => 'system', 'content' => $system ],
							[ 'role' => 'user',   'content' => $payload ],
						],
					]
				),
			]
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 ) {
			return new \WP_Error( 'ztrans_openai_http_' . $code, $body ?: 'OpenAI error', [ 'status' => $code ] );
		}

		$data = json_decode( $body, true );
		$out  = $data['choices'][0]['message']['content'] ?? '';
		if ( '' === $out ) {
			return new \WP_Error( 'ztrans_openai_empty', __( 'OpenAI returned an empty response.', 'zentranslate' ) );
		}

		$translations = $is_array ? array_map( 'trim', explode( self::DELIMITER, $out ) ) : [ trim( $out ) ];

		// If splits don't align, return as one large blob in the first slot.
		if ( $is_array && count( $translations ) !== count( $batch ) ) {
			$translations = array_pad( $translations, count( $batch ), '' );
		}

		return [
			'translations' => $translations,
			'provider'     => $this->name(),
			'model'        => $this->model,
		];
	}

	public function test_credentials() {
		$result = $this->translate( 'Hello', 'en', 'es' );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return true;
	}

	private function language_label( $code ) {
		$map = [
			'en' => 'English', 'es' => 'Spanish', 'fr' => 'French', 'de' => 'German',
			'it' => 'Italian', 'pt' => 'Portuguese', 'pt-br' => 'Brazilian Portuguese',
			'ru' => 'Russian', 'ja' => 'Japanese', 'zh-cn' => 'Simplified Chinese',
			'zh-tw' => 'Traditional Chinese', 'ar' => 'Arabic', 'he' => 'Hebrew',
			'hi' => 'Hindi', 'bn' => 'Bengali', 'ko' => 'Korean', 'tr' => 'Turkish',
			'nl' => 'Dutch', 'pl' => 'Polish',
		];
		return $map[ strtolower( $code ) ] ?? $code;
	}
}

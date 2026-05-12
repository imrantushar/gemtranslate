<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Google Cloud Translation v2 (key-based). The Advanced v3 API requires
 * OAuth — out of scope for v1 BYOK.
 */
class GoogleTranslator implements TranslatorInterface {

	const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

	private $api_key;

	public function __construct( $api_key = '' ) {
		$this->api_key = $api_key;
	}

	public function name() {
		return 'google';
	}

	public function translate( $texts, $source_lang, $target_lang, $context = [] ) {
		if ( empty( $this->api_key ) ) {
			return new \WP_Error( 'ztrans_no_key', __( 'Google API key is not configured.', 'zentranslate' ) );
		}
		$is_array = is_array( $texts );
		$batch    = $is_array ? array_values( $texts ) : [ (string) $texts ];

		$url = add_query_arg(
			[
				'key'    => $this->api_key,
				'source' => self::map_code( $source_lang ),
				'target' => self::map_code( $target_lang ),
				'format' => ! empty( $context['preserve_html'] ) ? 'html' : 'text',
			],
			self::ENDPOINT
		);
		$payload = [];
		foreach ( $batch as $t ) {
			$payload[] = [ 'q' => $t ];
		}
		// Google supports `q` as repeated query param or in body — body is cleaner.
		$body = [];
		foreach ( $batch as $t ) {
			$body[] = 'q=' . rawurlencode( $t );
		}

		$response = wp_remote_post(
			$url,
			[
				'timeout' => 60,
				'headers' => [ 'Content-Type' => 'application/x-www-form-urlencoded' ],
				'body'    => implode( '&', $body ),
			]
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 ) {
			return new \WP_Error( 'ztrans_google_http_' . $code, $raw ?: 'Google error', [ 'status' => $code ] );
		}
		$data = json_decode( $raw, true );
		$rows = $data['data']['translations'] ?? [];
		if ( empty( $rows ) ) {
			return new \WP_Error( 'ztrans_google_empty', __( 'Google returned no translations.', 'zentranslate' ) );
		}
		$translations = array_map( fn( $r ) => html_entity_decode( $r['translatedText'] ?? '', ENT_QUOTES, 'UTF-8' ), $rows );
		if ( ! $is_array ) {
			$translations = [ $translations[0] ?? '' ];
		}
		return [ 'translations' => $translations, 'provider' => $this->name(), 'model' => null ];
	}

	public function test_credentials() {
		$result = $this->translate( 'Hello', 'en', 'es' );
		return is_wp_error( $result ) ? $result : true;
	}

	private static function map_code( $code ) {
		$code = strtolower( $code );
		$map  = [ 'zh-cn' => 'zh-CN', 'zh-tw' => 'zh-TW', 'pt-br' => 'pt' ];
		return $map[ $code ] ?? explode( '-', $code )[0];
	}
}

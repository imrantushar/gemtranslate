<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * DeepL translator. Supports free and pro endpoints.
 */
class DeeplTranslator implements TranslatorInterface {

	const ENDPOINT_FREE = 'https://api-free.deepl.com/v2/translate';
	const ENDPOINT_PRO  = 'https://api.deepl.com/v2/translate';

	private $api_key;
	private $use_pro;

	public function __construct( $api_key = '', $use_pro = false ) {
		$this->api_key = $api_key;
		$this->use_pro = (bool) $use_pro;
	}

	public function name() {
		return 'deepl';
	}

	public function translate( $texts, $source_lang, $target_lang, $context = [] ) {
		if ( empty( $this->api_key ) ) {
			return new \WP_Error( 'ztrans_no_key', __( 'DeepL API key is not configured.', 'zentranslate' ) );
		}

		$is_array = is_array( $texts );
		$batch    = $is_array ? array_values( $texts ) : [ (string) $texts ];
		if ( empty( $batch ) ) {
			return [ 'translations' => [], 'provider' => $this->name(), 'model' => null ];
		}

		$body = [
			'auth_key'    => $this->api_key,
			'source_lang' => strtoupper( self::map_code( $source_lang ) ),
			'target_lang' => strtoupper( self::map_code( $target_lang ) ),
			'tag_handling' => 'html',
			'preserve_formatting' => '1',
		];
		// Repeated `text` params.
		$body_pairs = [];
		foreach ( $body as $k => $v ) {
			$body_pairs[] = rawurlencode( $k ) . '=' . rawurlencode( $v );
		}
		foreach ( $batch as $t ) {
			$body_pairs[] = 'text=' . rawurlencode( $t );
		}

		$endpoint = $this->use_pro ? self::ENDPOINT_PRO : self::ENDPOINT_FREE;
		$response = wp_remote_post(
			$endpoint,
			[
				'timeout' => 60,
				'headers' => [ 'Content-Type' => 'application/x-www-form-urlencoded' ],
				'body'    => implode( '&', $body_pairs ),
			]
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$body_raw = wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 ) {
			return new \WP_Error( 'ztrans_deepl_http_' . $code, $body_raw ?: 'DeepL error', [ 'status' => $code ] );
		}
		$data = json_decode( $body_raw, true );
		if ( ! isset( $data['translations'] ) ) {
			return new \WP_Error( 'ztrans_deepl_empty', __( 'DeepL returned no translations.', 'zentranslate' ) );
		}
		$translations = array_map( fn( $row ) => $row['text'] ?? '', $data['translations'] );
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
		$map  = [
			'pt-br' => 'PT-BR',
			'pt-pt' => 'PT-PT',
			'zh-cn' => 'ZH',
			'zh-tw' => 'ZH',
			'en-gb' => 'EN-GB',
			'en-us' => 'EN-US',
		];
		return $map[ $code ] ?? strtoupper( explode( '-', $code )[0] );
	}
}

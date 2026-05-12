<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Zentranslate Cloud client.
 *
 * Calls an HTTPS endpoint with a license key. The proxy on the other side
 * is responsible for routing to OpenAI / DeepL / Google, metering credits,
 * and returning a uniform `{ translations: string[], provider, model }`
 * payload. Same shape as our other translators.
 *
 * Expected proxy request:
 *   POST <cloud_url>/translate
 *   Authorization: Bearer <license_key>
 *   Body: { source_lang, target_lang, texts: string[], preserve_html, glossary }
 *
 * Expected proxy response:
 *   200 { translations: string[], provider, model, credits_used }
 *   4xx { error: { code, message } }
 */
class CloudTranslator implements TranslatorInterface {

	private $license_key;
	private $endpoint;

	public function __construct( $license_key = '', $endpoint = '' ) {
		$this->license_key = $license_key;
		$this->endpoint    = rtrim( $endpoint, '/' );
	}

	public function name() {
		return 'cloud';
	}

	public function translate( $texts, $source_lang, $target_lang, $context = [] ) {
		if ( empty( $this->license_key ) || empty( $this->endpoint ) ) {
			return new \WP_Error( 'ztrans_no_cloud', __( 'Zentranslate Cloud is not configured.', 'zentranslate' ) );
		}
		$is_array = is_array( $texts );
		$batch    = $is_array ? array_values( $texts ) : [ (string) $texts ];

		$response = wp_remote_post(
			$this->endpoint . '/translate',
			[
				'timeout' => 90,
				'headers' => [
					'Authorization' => 'Bearer ' . $this->license_key,
					'Content-Type'  => 'application/json',
					'User-Agent'    => 'Zentranslate/' . ZTRANS_VERSION . ' (' . home_url() . ')',
				],
				'body'    => wp_json_encode(
					[
						'source_lang'   => $source_lang,
						'target_lang'   => $target_lang,
						'texts'         => $batch,
						'preserve_html' => ! empty( $context['preserve_html'] ),
						'glossary'      => $context['glossary'] ?? [],
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
			$decoded = json_decode( $body, true );
			$msg     = $decoded['error']['message'] ?? ( $body ?: 'Cloud error' );
			return new \WP_Error( 'ztrans_cloud_http_' . $code, $msg, [ 'status' => $code ] );
		}
		$data         = json_decode( $body, true );
		$translations = $data['translations'] ?? [];
		if ( ! $is_array ) {
			$translations = [ $translations[0] ?? '' ];
		}
		return [
			'translations' => $translations,
			'provider'     => $this->name(),
			'model'        => $data['model'] ?? null,
		];
	}

	public function test_credentials() {
		if ( empty( $this->license_key ) || empty( $this->endpoint ) ) {
			return new \WP_Error( 'ztrans_no_cloud', __( 'License key and endpoint are required.', 'zentranslate' ) );
		}
		$response = wp_remote_get(
			$this->endpoint . '/ping',
			[
				'timeout' => 15,
				'headers' => [ 'Authorization' => 'Bearer ' . $this->license_key ],
			]
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code >= 300 ) {
			return new \WP_Error( 'ztrans_cloud_http_' . $code, wp_remote_retrieve_body( $response ) ?: 'Cloud unreachable.' );
		}
		return true;
	}
}

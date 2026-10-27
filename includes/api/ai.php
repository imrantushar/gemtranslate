<?php
namespace Zentranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\AI\Glossary;
use Zentranslate\AI\TranslationMemory;
use Zentranslate\AI\TranslatorFactory;
use Zentranslate\Language\Context;

class AI extends Controller {

	protected $rest_base = 'ai';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/providers',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'list_providers' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_providers' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/providers/(?P<name>openai|deepl|google|cloud)/test',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'test_provider' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/translate',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'translate' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'text'         => [ 'required' => true ],
					'source_lang'  => [ 'type' => 'string' ],
					'target_lang'  => [ 'type' => 'string', 'required' => true ],
					'provider'     => [ 'type' => 'string' ],
					'preserve_html'=> [ 'type' => 'boolean', 'default' => true ],
					'use_memory'   => [ 'type' => 'boolean', 'default' => true ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/glossary',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'list_glossary' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'add_glossary' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/glossary/(?P<id>\d+)',
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_glossary' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/memory/stats',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'memory_stats' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/memory/suggest',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'memory_suggest' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'text'        => [ 'type' => 'string', 'required' => true ],
					'source_lang' => [ 'type' => 'string' ],
					'target_lang' => [ 'type' => 'string', 'required' => true ],
					'limit'       => [ 'type' => 'integer', 'default' => 5 ],
				],
			]
		);
	}

	public function list_providers( $request ) {
		$settings = TranslatorFactory::settings();
		// Redact API keys in the read response.
		foreach ( $settings['providers'] as $name => $cfg ) {
			if ( isset( $cfg['api_key'] ) && $cfg['api_key'] !== '' ) {
				$settings['providers'][ $name ]['has_key'] = true;
				$settings['providers'][ $name ]['api_key'] = '••••' . substr( $cfg['api_key'], -4 );
			} else {
				$settings['providers'][ $name ]['has_key'] = false;
			}
		}
		return $this->ok( $settings );
	}

	public function save_providers( $request ) {
		$body = $request->get_json_params() ?: $request->get_params();
		$existing = TranslatorFactory::settings();

		$default   = isset( $body['default'] ) ? sanitize_key( $body['default'] ) : $existing['default'];
		$providers = $existing['providers'];

		if ( isset( $body['providers'] ) && is_array( $body['providers'] ) ) {
			foreach ( $body['providers'] as $name => $cfg ) {
				if ( ! in_array( $name, TranslatorFactory::provider_names(), true ) ) {
					continue;
				}
				$current = $providers[ $name ] ?? [];

				// Preserve API key if the submitted one is the masked placeholder.
				if ( isset( $cfg['api_key'] ) && $cfg['api_key'] !== '' && strpos( $cfg['api_key'], '••••' ) !== 0 ) {
					$current['api_key'] = (string) $cfg['api_key'];
				} elseif ( ! isset( $cfg['api_key'] ) || $cfg['api_key'] === '' ) {
					$current['api_key'] = '';
				}

				foreach ( [ 'model', 'use_pro', 'endpoint' ] as $k ) {
					if ( array_key_exists( $k, $cfg ) ) {
						$current[ $k ] = $cfg[ $k ];
					}
				}
				$providers[ $name ] = $current;
			}
		}

		TranslatorFactory::save_settings( [ 'default' => $default, 'providers' => $providers ] );
		return $this->list_providers( $request );
	}

	public function test_provider( $request ) {
		$name      = $request['name'];
		$body      = $request->get_json_params() ?: $request->get_params();

		// Allow inline credentials for a transient test before saving.
		if ( ! empty( $body['api_key'] ) || ! empty( $body['endpoint'] ) ) {
			switch ( $name ) {
				case 'openai':
					$translator = new \Zentranslate\AI\OpenAiTranslator( $body['api_key'] ?? '', $body['model'] ?? '' );
					break;
				case 'deepl':
					$translator = new \Zentranslate\AI\DeeplTranslator( $body['api_key'] ?? '', ! empty( $body['use_pro'] ) );
					break;
				case 'google':
					$translator = new \Zentranslate\AI\GoogleTranslator( $body['api_key'] ?? '' );
					break;
				case 'cloud':
					$translator = new \Zentranslate\AI\CloudTranslator( $body['api_key'] ?? '', $body['endpoint'] ?? '' );
					break;
				default:
					return $this->fail( 'ztrans_unknown_provider', __( 'Unknown provider.', 'zentranslate' ), 400 );
			}
		} else {
			$translator = TranslatorFactory::make( $name );
		}

		if ( ! $translator ) {
			return $this->fail( 'ztrans_unknown_provider', __( 'Unknown provider.', 'zentranslate' ), 400 );
		}
		$result = $translator->test_credentials();
		if ( is_wp_error( $result ) ) {
			return $this->fail( $result->get_error_code(), $result->get_error_message(), 422 );
		}
		return $this->ok( [ 'ok' => true, 'provider' => $name ] );
	}

	public function translate( $request ) {
		$body = $request->get_json_params() ?: $request->get_params();
		$text = $body['text'] ?? '';
		$source = (string) ( $body['source_lang'] ?? Context::default_code() );
		$target = (string) ( $body['target_lang'] ?? '' );
		$provider_name = (string) ( $body['provider'] ?? '' );

		if ( '' === $target ) {
			return $this->fail( 'ztrans_missing_target', __( 'target_lang is required.', 'zentranslate' ), 422 );
		}
		$translator = $provider_name ? TranslatorFactory::make( $provider_name ) : TranslatorFactory::default_translator();
		if ( ! $translator ) {
			return $this->fail( 'ztrans_no_provider', __( 'No translator is configured.', 'zentranslate' ), 400 );
		}

		$is_batch = is_array( $text );
		$texts    = $is_batch ? array_values( $text ) : [ (string) $text ];
		$translations = array_fill( 0, count( $texts ), null );
		$to_fetch     = [];

		// Translation Memory + Glossary are Pro enhancements. The single-text
		// "AI taste" still works in free; it just skips TM/glossary when Pro is
		// inactive (classes absent).
		$has_memory   = ! empty( $body['use_memory'] ) && class_exists( TranslationMemory::class );
		$has_glossary = class_exists( Glossary::class );

		if ( $has_memory ) {
			foreach ( $texts as $i => $t ) {
				$cached = TranslationMemory::get( $t, $source, $target );
				if ( null !== $cached ) {
					$translations[ $i ] = $cached;
				} else {
					$to_fetch[ $i ] = $t;
				}
			}
		} else {
			foreach ( $texts as $i => $t ) {
				$to_fetch[ $i ] = $t;
			}
		}

		if ( ! empty( $to_fetch ) ) {
			$glossary_pairs = $has_glossary ? Glossary::build_context( $source, $target )['pairs'] : [];
			$result         = $translator->translate(
				array_values( $to_fetch ),
				$source,
				$target,
				[
					'preserve_html' => ! empty( $body['preserve_html'] ),
					'glossary'      => $glossary_pairs,
				]
			);
			if ( is_wp_error( $result ) ) {
				return $this->fail( $result->get_error_code(), $result->get_error_message(), 502 );
			}
			$i = 0;
			foreach ( array_keys( $to_fetch ) as $orig_index ) {
				$value = $result['translations'][ $i ] ?? '';
				$translations[ $orig_index ] = $value;
				if ( $has_memory && '' !== $value ) {
					TranslationMemory::set( $to_fetch[ $orig_index ], $value, $source, $target, $result['provider'] );
				}
				$i++;
			}
		}

		return $this->ok(
			[
				'translations' => $is_batch ? $translations : ( $translations[0] ?? '' ),
				'provider'     => $translator->name(),
			]
		);
	}

	public function list_glossary( $request ) {
		if ( $err = $this->require_pro( 'glossary' ) ) {
			return $err;
		}
		global $wpdb;
		$rows = $wpdb->get_results( "SELECT * FROM " . \Zentranslate\Helper::table( 'glossary' ) . " ORDER BY term_id DESC", ARRAY_A ) ?: [];
		return $this->ok( $rows );
	}

	public function add_glossary( $request ) {
		if ( $err = $this->require_pro( 'glossary' ) ) {
			return $err;
		}
		$body = $request->get_json_params() ?: $request->get_params();
		$ok   = Glossary::add(
			(string) ( $body['source_lang'] ?? '' ),
			(string) ( $body['target_lang'] ?? '' ),
			(string) ( $body['source_term'] ?? '' ),
			(string) ( $body['target_term'] ?? '' ),
			[
				'case_sensitive'   => ! empty( $body['case_sensitive'] ),
				'do_not_translate' => ! empty( $body['do_not_translate'] ),
			]
		);
		if ( ! $ok ) {
			return $this->fail( 'ztrans_save_failed', __( 'Could not add glossary term.', 'zentranslate' ), 500 );
		}
		return $this->ok( [ 'saved' => true ] );
	}

	public function delete_glossary( $request ) {
		if ( $err = $this->require_pro( 'glossary' ) ) {
			return $err;
		}
		Glossary::delete( (int) $request['id'] );
		return $this->ok( [ 'deleted' => true ] );
	}

	public function memory_stats( $request ) {
		if ( $err = $this->require_pro( 'translation_memory' ) ) {
			return $err;
		}
		return $this->ok( TranslationMemory::stats() );
	}

	public function memory_suggest( $request ) {
		if ( $err = $this->require_pro( 'translation_memory' ) ) {
			return $err;
		}
		$body   = $request->get_json_params() ?: $request->get_params();
		$text   = (string) ( $body['text'] ?? '' );
		$source = (string) ( $body['source_lang'] ?? Context::default_code() );
		$target = (string) ( $body['target_lang'] ?? '' );
		$limit  = (int) ( $body['limit'] ?? 5 );

		if ( '' === $target ) {
			return $this->fail( 'ztrans_missing_target', __( 'target_lang is required.', 'zentranslate' ), 422 );
		}

		return $this->ok(
			[ 'suggestions' => TranslationMemory::suggest( $text, $source, $target, $limit ) ]
		);
	}
}

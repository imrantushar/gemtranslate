<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds provider instances from saved settings. Provider config lives in the
 * `ztrans_ai_providers` option as JSON:
 *
 * {
 *   "default": "openai",
 *   "providers": {
 *     "openai": { "api_key": "...", "model": "gpt-4o-mini" },
 *     "deepl":  { "api_key": "...", "use_pro": false },
 *     "google": { "api_key": "..." }
 *   }
 * }
 */
class TranslatorFactory {

	const OPTION_KEY = 'ztrans_ai_providers';

	public static function settings() {
		$raw  = get_option( self::OPTION_KEY, '' );
		$data = $raw ? json_decode( $raw, true ) : [];
		if ( ! is_array( $data ) ) {
			$data = [];
		}
		$data['default']   = $data['default']   ?? '';
		$data['providers'] = $data['providers'] ?? [];
		return $data;
	}

	public static function save_settings( array $data ) {
		return update_option( self::OPTION_KEY, wp_json_encode( $data ), false );
	}

	public static function make( $name ) {
		$settings  = self::settings();
		$cfg       = $settings['providers'][ $name ] ?? [];

		switch ( $name ) {
			case 'openai':
				return new OpenAiTranslator( $cfg['api_key'] ?? '', $cfg['model'] ?? '' );
			case 'deepl':
				return new DeeplTranslator( $cfg['api_key'] ?? '', ! empty( $cfg['use_pro'] ) );
			case 'google':
				return new GoogleTranslator( $cfg['api_key'] ?? '' );
		}
		return null;
	}

	public static function default_translator() {
		$settings = self::settings();
		$name     = $settings['default'] ?: 'openai';
		return self::make( $name );
	}

	public static function provider_names() {
		return [ 'openai', 'deepl', 'google' ];
	}
}

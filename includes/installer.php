<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Installer {

	public static function init() {
		$self = new self();
		$self->run_migrator();
		$self->seed_default_language();
		$self->add_capabilities();
		$self->save_option();
		Helper::flush_rewrite_rules();
	}

	/**
	 * Grant translator capability to admin and editor roles. Idempotent.
	 */
	public function add_capabilities() {
		$cap = 'ztrans_translate_content';
		foreach ( [ 'administrator', 'editor' ] as $role_name ) {
			$role = get_role( $role_name );
			if ( $role && ! $role->has_cap( $cap ) ) {
				$role->add_cap( $cap );
			}
		}
	}

	public function run_migrator() {
		Database\Migrator::install();
	}

	/**
	 * Seed the default language (from WordPress site locale) on first install.
	 */
	public function seed_default_language() {
		$registry = new Language\LanguageRegistry();
		if ( $registry->count() > 0 ) {
			return;
		}

		$locale = get_locale() ?: 'en_US';
		$code   = self::derive_code_from_locale( $locale );

		$registry->insert(
			[
				'code'        => $code,
				'locale'      => $locale,
				'name'        => self::locale_to_english_name( $locale ),
				'native_name' => self::locale_to_native_name( $locale ),
				'flag'        => $code,
				'is_rtl'      => self::locale_is_rtl( $locale ) ? 1 : 0,
				'is_default'  => 1,
				'active'      => 1,
				'position'    => 0,
			]
		);
	}

	public function save_option() {
		if ( ! get_option( 'ztrans_version' ) ) {
			add_option( 'ztrans_version', ZTRANS_VERSION );
		}
		if ( ! get_option( 'ztrans_db_version' ) ) {
			add_option( 'ztrans_db_version', ZTRANS_DB_VERSION );
		}
		if ( ! get_option( 'ztrans_first_install_time' ) ) {
			add_option( 'ztrans_first_install_time', Helper::get_time() );
		}
	}

	private static function derive_code_from_locale( $locale ) {
		// 'en_US' -> 'en', 'pt_BR' -> 'pt-br' (keep region for variants).
		$parts = explode( '_', $locale );
		if ( count( $parts ) === 1 ) {
			return strtolower( $parts[0] );
		}
		// Only keep region for known split-locales.
		$split_locales = [ 'pt_BR', 'pt_PT', 'zh_CN', 'zh_TW', 'zh_HK', 'es_MX', 'es_AR', 'en_GB', 'en_AU', 'en_CA', 'fr_CA' ];
		if ( in_array( $locale, $split_locales, true ) ) {
			return strtolower( $parts[0] . '-' . $parts[1] );
		}
		return strtolower( $parts[0] );
	}

	private static function locale_to_english_name( $locale ) {
		$map = [
			'en_US' => 'English',
			'en_GB' => 'English (UK)',
			'es_ES' => 'Spanish',
			'fr_FR' => 'French',
			'de_DE' => 'German',
			'it_IT' => 'Italian',
			'pt_BR' => 'Portuguese (Brazil)',
			'pt_PT' => 'Portuguese (Portugal)',
			'ru_RU' => 'Russian',
			'ja'    => 'Japanese',
			'zh_CN' => 'Chinese (Simplified)',
			'zh_TW' => 'Chinese (Traditional)',
			'ar'    => 'Arabic',
			'he_IL' => 'Hebrew',
			'hi_IN' => 'Hindi',
			'bn_BD' => 'Bengali',
			'ko_KR' => 'Korean',
			'tr_TR' => 'Turkish',
			'nl_NL' => 'Dutch',
			'pl_PL' => 'Polish',
		];
		return $map[ $locale ] ?? $locale;
	}

	private static function locale_to_native_name( $locale ) {
		$map = [
			'en_US' => 'English',
			'en_GB' => 'English',
			'es_ES' => 'Español',
			'fr_FR' => 'Français',
			'de_DE' => 'Deutsch',
			'it_IT' => 'Italiano',
			'pt_BR' => 'Português',
			'pt_PT' => 'Português',
			'ru_RU' => 'Русский',
			'ja'    => '日本語',
			'zh_CN' => '简体中文',
			'zh_TW' => '繁體中文',
			'ar'    => 'العربية',
			'he_IL' => 'עברית',
			'hi_IN' => 'हिन्दी',
			'bn_BD' => 'বাংলা',
			'ko_KR' => '한국어',
			'tr_TR' => 'Türkçe',
			'nl_NL' => 'Nederlands',
			'pl_PL' => 'Polski',
		];
		return $map[ $locale ] ?? $locale;
	}

	private static function locale_is_rtl( $locale ) {
		$rtl = [ 'ar', 'he_IL', 'fa_IR', 'ur', 'ps', 'syr', 'dv', 'ckb' ];
		return in_array( $locale, $rtl, true );
	}
}

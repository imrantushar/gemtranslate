<?php
namespace Zentranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;

/**
 * Switch the WP locale to each email recipient's preferred Zentranslate
 * language for the duration of the `wp_mail()` call, then restore.
 *
 * Triggered via the `wp_mail` filter, which fires before subject and body
 * are rendered by callers like password-reset / comment-notify / WooCommerce.
 *
 * Opt-in via `translate_emails` setting (default off — translating emails
 * to the wrong language is worse than English fallback).
 */
class MailLocalizer {

	private static $stack = [];

	public static function init() {
		add_filter( 'wp_mail', [ __CLASS__, 'before_send' ], 1 );
		add_action( 'wp_mail_succeeded', [ __CLASS__, 'after_send' ] );
		add_action( 'wp_mail_failed', [ __CLASS__, 'after_send' ] );
	}

	public static function enabled() {
		$raw = get_option( ZTRANS_SETTINGS_NAME, '{}' );
		$cfg = json_decode( $raw, true ) ?: [];
		return ! empty( $cfg['translate_emails'] );
	}

	public static function before_send( $args ) {
		if ( ! self::enabled() ) {
			return $args;
		}
		// Resolve the *primary* recipient — translating to the first user's
		// language is the pragmatic default. Bulk emails to multiple users
		// can't honor every recipient's language without splitting sends.
		$to       = $args['to'] ?? '';
		$primary  = is_array( $to ) ? reset( $to ) : $to;
		$email    = self::extract_email( (string) $primary );
		$user     = $email ? get_user_by( 'email', $email ) : null;
		$lang_code = $user ? (string) get_user_meta( $user->ID, ProfileField::META_KEY, true ) : '';
		if ( '' === $lang_code || ! Context::is_active( $lang_code ) ) {
			return $args;
		}

		$langs   = Context::active_languages();
		$locale  = $langs[ $lang_code ]['locale'] ?? '';
		if ( '' === $locale ) {
			return $args;
		}

		// Swap locale via a `locale` filter we add and remove ourselves.
		$filter = function () use ( $locale ) {
			return $locale;
		};
		self::$stack[] = $filter;
		add_filter( 'locale', $filter, 99 );

		// Also reload textdomains so already-loaded plugin translations refresh.
		if ( function_exists( 'unload_textdomain' ) ) {
			unload_textdomain( 'default' );
			unload_textdomain( 'zentranslate' );
		}
		load_default_textdomain( $locale );
		load_plugin_textdomain( 'zentranslate', false, dirname( ZTRANS_PLUGIN_BASENAME ) . '/languages/' );

		// Also push our Context so any gettext-filtered string Zentranslate
		// owns swaps to the right language.
		self::$stack[ count( self::$stack ) - 1 ] = [
			'filter'  => $filter,
			'context' => Context::current(),
		];
		Context::set( $lang_code );

		return $args;
	}

	public static function after_send( $mail_data = null ) {
		if ( empty( self::$stack ) ) {
			return;
		}
		$frame = array_pop( self::$stack );
		if ( is_array( $frame ) ) {
			remove_filter( 'locale', $frame['filter'], 99 );
			Context::set( $frame['context'] );
		}
		// Restore default textdomain.
		if ( function_exists( 'unload_textdomain' ) ) {
			unload_textdomain( 'default' );
		}
		load_default_textdomain( get_locale() );
	}

	private static function extract_email( $raw ) {
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return '';
		}
		if ( preg_match( '/<(.+@.+)>/', $raw, $m ) ) {
			return strtolower( $m[1] );
		}
		return strtolower( $raw );
	}
}

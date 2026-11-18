<?php
/**
 * StoreEngine SDK initializer (free build).
 *
 * Boots the StoreEngine WordPress SDK for GemTranslate: opt-in insights, the
 * deactivation-reason feedback modal and the store-hosted updater. GemTranslate
 * Pro reuses this copy of the SDK.
 *
 * @package GemTranslate
 */

namespace GemTranslate;

use SE_License_SDK_Client;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SeSdk {

	/**
	 * Free GemTranslate product ID on store.kodezen.com.
	 *
	 * The SDK fatals when initialised without a valid product ID, so a value of
	 * 0 leaves it dormant instead of booting it.
	 */
	private const PRODUCT_ID = 529;

	private static ?SE_License_SDK_Client $client = null;

	public function __construct() {
		$this->get_sdk();
	}

	public function get_sdk(): ?SE_License_SDK_Client {
		if ( self::PRODUCT_ID <= 0 || ! function_exists( 'se_license_init' ) ) {
			return null;
		}

		if ( null === self::$client ) {
			// The SDK types this as int; the option holds a MySQL datetime.
			$installed = get_option( 'gtrans_first_install_time' );
			$installed = is_numeric( $installed ) ? (int) $installed : (int) strtotime( (string) $installed );

			self::$client = se_license_init(
				[
					'package_file'        => GTRANS_PLUGIN_FILE,
					'package_name'        => 'GemTranslate', // Not translated; loads too early.
					'product_id'          => self::PRODUCT_ID,
					'is_free'             => true,
					'use_update'          => true,
					'slug'                => GTRANS_PLUGIN_SLUG,
					'basename'            => GTRANS_PLUGIN_BASENAME,
					'package_type'        => 'plugin',
					'package_version'     => GTRANS_VERSION,
					'allow_local'         => true,
					'license_server'      => 'https://store.kodezen.com/',
					'purchase_url'        => 'https://store.kodezen.com/product/gemtranslate/',
					'store_dashboard_url' => 'https://store.kodezen.com/dashboard/license-keys/',
					'terms_url'           => 'https://kodezen.com/terms-and-conditions/',
					'privacy_policy_url'  => 'https://store.kodezen.com/privacy-policy/',
					'support_url'         => 'https://community.kodezen.com/tickets',
					'ticket_recipient'    => 'support@kodezen.com',
					'primary_color'       => '#2A3BEE',
					'first_install_time'  => $installed,
					'optin_notice_delay'  => 3 * DAY_IN_SECONDS,
				]
			);
		}

		return self::$client;
	}
}

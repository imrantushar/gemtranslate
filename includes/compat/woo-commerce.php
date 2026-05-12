<?php
namespace Zentranslate\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Language\Context;
use Zentranslate\Translation\TranslationLoader;

/**
 * WooCommerce product translation bridge.
 *
 * Products are translated via the same post_translations table as posts.
 * The PostTranslator already handles `the_title` / `the_content`, but Woo
 * uses its own getters (`product->get_name()`, `get_description()`, …) that
 * bypass those filters. We re-apply translations on the Woo-specific filters.
 */
class WooCommerce {

	public static function init() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		$self = new self();
		add_filter( 'woocommerce_product_get_name', [ $self, 'translate_name' ], 10, 2 );
		add_filter( 'woocommerce_product_get_description', [ $self, 'translate_description' ], 10, 2 );
		add_filter( 'woocommerce_product_get_short_description', [ $self, 'translate_short_description' ], 10, 2 );

		// Variations.
		add_filter( 'woocommerce_product_variation_get_name', [ $self, 'translate_name' ], 10, 2 );
		add_filter( 'woocommerce_product_variation_get_description', [ $self, 'translate_description' ], 10, 2 );
	}

	public function translate_name( $value, $product ) {
		if ( Context::is_default() || ! $product ) {
			return $value;
		}
		$row = TranslationLoader::get_for_post( $product->get_id() );
		return $row && '' !== (string) $row['title'] ? $row['title'] : $value;
	}

	public function translate_description( $value, $product ) {
		if ( Context::is_default() || ! $product ) {
			return $value;
		}
		$row = TranslationLoader::get_for_post( $product->get_id() );
		return $row && '' !== (string) $row['content'] ? $row['content'] : $value;
	}

	public function translate_short_description( $value, $product ) {
		if ( Context::is_default() || ! $product ) {
			return $value;
		}
		$row = TranslationLoader::get_for_post( $product->get_id() );
		return $row && '' !== (string) $row['excerpt'] ? $row['excerpt'] : $value;
	}
}

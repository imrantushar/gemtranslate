<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;
use GemTranslate\Translation\LayoutItems;
use GemTranslate\Translation\LayoutTranslator;

/**
 * Site-wide layout translation: template parts, synced patterns, navigation.
 */
class Layout extends Controller {

	protected $rest_base = 'layout';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/items',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'items' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/units/(?P<lang>[a-z0-9\-]{2,10})',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'units' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
				'args'                => [ 'id' => [ 'type' => 'string', 'required' => true ] ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/translations/(?P<lang>[a-z0-9\-]{2,10})',
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save' ],
				'permission_callback' => [ $this, 'permissions_translate' ],
			]
		);
	}

	public function items( $request ) {
		$lang = strtolower( (string) $request->get_param( 'lang' ) );
		$active  = '' !== $lang && Context::is_active( $lang );
		$country = CountryContext::normalize( $request->get_param( 'country' ) );
		return $this->ok(
			$active ? LayoutItems::with_progress( $lang, $country ) : LayoutItems::all(),
			[
				'supported' => LayoutItems::is_supported(),
				'countries' => $active ? LayoutTranslator::countries_for( $lang ) : [],
			]
		);
	}

	public function units( $request ) {
		$lang = strtolower( (string) $request['lang'] );
		if ( ! Context::is_active( $lang ) ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Language is not active.', 'gemtranslate' ), 422 );
		}
		$units = LayoutItems::units(
			(string) $request->get_param( 'id' ),
			$lang,
			CountryContext::normalize( $request->get_param( 'country' ) )
		);
		if ( null === $units ) {
			return $this->fail( 'gtrans_not_found', __( 'Layout item not found.', 'gemtranslate' ), 404 );
		}
		return $this->ok( $units, [ 'count' => count( $units ) ] );
	}

	public function save( $request ) {
		$lang = strtolower( (string) $request['lang'] );
		if ( ! Context::is_active( $lang ) || Context::default_code() === $lang ) {
			return $this->fail( 'gtrans_invalid_lang', __( 'Pick an active, non-default language.', 'gemtranslate' ), 422 );
		}
		$body    = $request->get_json_params() ?: $request->get_params();
		$country = CountryContext::normalize( $body['country'] ?? '' );

		// One string, or a batch: { units: [ { source, translation }, … ] }.
		$units = isset( $body['units'] ) && is_array( $body['units'] )
			? $body['units']
			: [ [ 'source' => $body['source'] ?? '', 'translation' => $body['translation'] ?? '' ] ];

		$saved = 0;
		foreach ( $units as $unit ) {
			$source = (string) ( $unit['source'] ?? '' );
			if ( '' === trim( $source ) ) {
				continue;
			}
			if ( ! LayoutTranslator::save( $source, $lang, (string) ( $unit['translation'] ?? '' ), false, $country ) ) {
				return $this->fail( 'gtrans_save_failed', __( 'Could not save translation.', 'gemtranslate' ), 500 );
			}
			$saved++;
		}
		if ( 0 === $saved ) {
			return $this->fail( 'gtrans_bad_request', __( 'Missing source text.', 'gemtranslate' ), 422 );
		}
		// A layout string appears on every page: purge the page cache once.
		do_action( 'gtrans_translation_saved', 0 );
		return $this->ok( [ 'saved' => $saved, 'language_code' => $lang, 'country_code' => $country ] );
	}
}

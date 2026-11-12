<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\CountryContext;
use GemTranslate\Translation\LayoutItems;
use GemTranslate\Translation\LayoutTranslator;
use GemTranslate\Translation\LayoutVariants;

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
			'/' . $this->rest_base . '/variants',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'variants' ],
					'permission_callback' => [ $this, 'permissions_translate' ],
					'args'                => [ 'part' => [ 'type' => 'string', 'required' => true ] ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'save_variants' ],
					// Changes what every visitor from a country sees: admins only.
					'permission_callback' => [ $this, 'permissions_check' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/custom',
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'create_custom' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'remove_custom' ],
					'permission_callback' => [ $this, 'permissions_check' ],
				],
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

	public function variants( $request ) {
		$part = (string) $request->get_param( 'part' );
		if ( 0 !== strpos( $part, LayoutItems::TYPE_TEMPLATE_PART . ':' ) ) {
			return $this->fail( 'gtrans_bad_request', __( 'Only template parts can have country layouts.', 'gemtranslate' ), 422 );
		}
		$id      = substr( $part, strlen( LayoutItems::TYPE_TEMPLATE_PART ) + 1 );
		$choices = [];
		foreach ( LayoutItems::all() as $item ) {
			if ( LayoutItems::TYPE_TEMPLATE_PART === $item['type'] && $item['id'] !== $part ) {
				$choices[] = [
					'id'    => substr( $item['id'], strlen( LayoutItems::TYPE_TEMPLATE_PART ) + 1 ),
					'title' => $item['title'],
				];
			}
		}
		return $this->ok( LayoutVariants::for_part( $id ), [ 'choices' => $choices ] );
	}

	public function save_variants( $request ) {
		$body = $request->get_json_params() ?: $request->get_params();
		$part = (string) ( $body['part'] ?? '' );
		if ( 0 !== strpos( $part, LayoutItems::TYPE_TEMPLATE_PART . ':' ) ) {
			return $this->fail( 'gtrans_bad_request', __( 'Only template parts can have country layouts.', 'gemtranslate' ), 422 );
		}
		$id    = substr( $part, strlen( LayoutItems::TYPE_TEMPLATE_PART ) + 1 );
		$rules = LayoutVariants::save( $id, is_array( $body['rules'] ?? null ) ? $body['rules'] : [] );
		return $this->ok( $rules );
	}

	/** Give one language (and optional country) its own copy of a template part. */
	public function create_custom( $request ) {
		$body = $request->get_json_params() ?: $request->get_params();
		$part = (string) ( $body['part'] ?? '' );
		if ( 0 !== strpos( $part, LayoutItems::TYPE_TEMPLATE_PART . ':' ) ) {
			return $this->fail( 'gtrans_bad_request', __( 'Only template parts can have a custom layout.', 'gemtranslate' ), 422 );
		}
		$id   = substr( $part, strlen( LayoutItems::TYPE_TEMPLATE_PART ) + 1 );
		$rule = LayoutVariants::create_custom(
			$id,
			(string) ( $body['lang'] ?? '' ),
			(string) ( $body['country'] ?? '' ),
			'blank' === ( $body['start'] ?? '' ) ? 'blank' : 'copy'
		);
		if ( is_wp_error( $rule ) ) {
			$status = (int) ( $rule->get_error_data()['status'] ?? 500 );
			return $this->fail( $rule->get_error_code(), $rule->get_error_message(), $status );
		}
		return $this->ok( LayoutVariants::for_part( $id ) );
	}

	/** Back to the shared layout. The copy stays in the Site Editor. */
	public function remove_custom( $request ) {
		$body = $request->get_json_params() ?: $request->get_params();
		$part = (string) ( $body['part'] ?? '' );
		if ( 0 !== strpos( $part, LayoutItems::TYPE_TEMPLATE_PART . ':' ) ) {
			return $this->fail( 'gtrans_bad_request', __( 'Only template parts can have a custom layout.', 'gemtranslate' ), 422 );
		}
		$id = substr( $part, strlen( LayoutItems::TYPE_TEMPLATE_PART ) + 1 );
		return $this->ok( LayoutVariants::remove_custom( $id, (string) ( $body['lang'] ?? '' ), (string) ( $body['country'] ?? '' ) ) );
	}

	public function items() {
		$codes = [];
		foreach ( Context::active_languages() as $code => $lang ) {
			if ( Context::default_code() !== $code ) {
				$codes[] = $code;
			}
		}
		$countries = [];
		foreach ( $codes as $code ) {
			$countries[ $code ] = LayoutTranslator::countries_for( $code );
		}
		return $this->ok(
			LayoutItems::is_supported() ? LayoutItems::overview( $codes ) : [],
			[
				'supported' => LayoutItems::is_supported(),
				'languages' => $codes,
				'countries' => $countries,
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

<?php
namespace GemTranslate\API;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Migration\PolylangImporter;
use GemTranslate\Migration\TranslatePressImporter;
use GemTranslate\Migration\WpmlImporter;

class Migration extends Controller {

	protected $rest_base = 'migration';

	public static function init() {
		$self = new self();
		add_action( 'rest_api_init', [ $self, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/detect',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'detect' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/import',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'source' => [ 'type' => 'string', 'required' => true ],
				],
			]
		);
	}

	public function detect() {
		return $this->ok( [
			'wpml'           => WpmlImporter::detect(),
			'polylang'       => PolylangImporter::detect(),
			'translatepress' => TranslatePressImporter::detect(),
		] );
	}

	public function import( $request ) {
		$source = sanitize_key( $request->get_param( 'source' ) );
		@set_time_limit( 600 );
		switch ( $source ) {
			case 'wpml':
				$result = WpmlImporter::run();
				break;
			case 'polylang':
				$result = PolylangImporter::run();
				break;
			case 'translatepress':
				$result = TranslatePressImporter::run();
				break;
			default:
				return $this->fail( 'gtrans_unknown_source', __( 'Unknown migration source.', 'gemtranslate' ), 400 );
		}
		return $this->ok( $result->to_array() );
	}
}

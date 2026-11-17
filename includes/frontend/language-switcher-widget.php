<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classic WP_Widget for the language switcher. Lets users drop a switcher
 * into theme widget areas on classic themes.
 */
class LanguageSwitcherWidget extends \WP_Widget {

	public function __construct() {
		parent::__construct(
			'gemtranslate_language_switcher',
			__( 'GemTranslate language switcher', 'gemtranslate' ),
			[ 'description' => __( 'Switch between all active languages.', 'gemtranslate' ) ]
		);
	}

	public static function init() {
		add_action( 'widgets_init', function () {
			register_widget( __CLASS__ );
		} );
	}

	public function widget( $args, $instance ) {
		echo $args['before_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		if ( ! empty( $instance['title'] ) ) {
			echo $args['before_title'] . esc_html( $instance['title'] ) . $args['after_title']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		$switcher = new LanguageSwitcher();
		echo $switcher->render_shortcode( [
			'display'     => $instance['display'] ?? 'inline',
			'show_flag'   => ! empty( $instance['show_flag'] ) ? '1' : '0',
			'show_name'   => ! empty( $instance['show_name'] ) ? '1' : '0',
			'show_native' => ! empty( $instance['show_native'] ) ? '1' : '0',
		] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $args['after_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	public function form( $instance ) {
		$title       = $instance['title'] ?? '';
		$display     = $instance['display'] ?? 'inline';
		$show_flag   = ! empty( $instance['show_flag'] );
		$show_name   = ! isset( $instance['show_name'] ) || ! empty( $instance['show_name'] );
		$show_native = ! empty( $instance['show_native'] );
		?>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>"><?php esc_html_e( 'Title', 'gemtranslate' ); ?></label>
			<input class="widefat" type="text" id="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'title' ) ); ?>" value="<?php echo esc_attr( $title ); ?>" />
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'display' ) ); ?>"><?php esc_html_e( 'Display', 'gemtranslate' ); ?></label>
			<select class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'display' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'display' ) ); ?>">
				<option value="inline" <?php selected( $display, 'inline' ); ?>><?php esc_html_e( 'Inline list', 'gemtranslate' ); ?></option>
				<option value="dropdown" <?php selected( $display, 'dropdown' ); ?>><?php esc_html_e( 'Dropdown', 'gemtranslate' ); ?></option>
			</select>
		</p>
		<p>
			<input type="checkbox" id="<?php echo esc_attr( $this->get_field_id( 'show_flag' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'show_flag' ) ); ?>" value="1" <?php checked( $show_flag ); ?> />
			<label for="<?php echo esc_attr( $this->get_field_id( 'show_flag' ) ); ?>"><?php esc_html_e( 'Show flag', 'gemtranslate' ); ?></label>
		</p>
		<p>
			<input type="checkbox" id="<?php echo esc_attr( $this->get_field_id( 'show_name' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'show_name' ) ); ?>" value="1" <?php checked( $show_name ); ?> />
			<label for="<?php echo esc_attr( $this->get_field_id( 'show_name' ) ); ?>"><?php esc_html_e( 'Show English name', 'gemtranslate' ); ?></label>
		</p>
		<p>
			<input type="checkbox" id="<?php echo esc_attr( $this->get_field_id( 'show_native' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'show_native' ) ); ?>" value="1" <?php checked( $show_native ); ?> />
			<label for="<?php echo esc_attr( $this->get_field_id( 'show_native' ) ); ?>"><?php esc_html_e( 'Show native name', 'gemtranslate' ); ?></label>
		</p>
		<?php
	}

	public function update( $new_instance, $old_instance ) {
		return [
			'title'       => sanitize_text_field( $new_instance['title'] ?? '' ),
			'display'     => in_array( ( $new_instance['display'] ?? 'inline' ), [ 'inline', 'dropdown' ], true ) ? $new_instance['display'] : 'inline',
			'show_flag'   => ! empty( $new_instance['show_flag'] ) ? 1 : 0,
			'show_name'   => ! empty( $new_instance['show_name'] ) ? 1 : 0,
			'show_native' => ! empty( $new_instance['show_native'] ) ? 1 : 0,
		];
	}
}

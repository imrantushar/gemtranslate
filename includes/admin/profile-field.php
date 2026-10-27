<?php
namespace GemTranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Language\LanguageRegistry;

/**
 * Renders and saves a "GemTranslate language" picker in the WP user-profile
 * screen. Stored in user meta key `gtrans_preferred_language`.
 *
 * When set, the user sees the WP admin UI in their preferred language —
 * any plugin/theme string that flows through gettext gets swapped, and
 * GemTranslate's own React admin reads the same value to localize itself.
 */
class ProfileField {

	const META_KEY = 'gtrans_preferred_language';

	public static function init() {
		$self = new self();
		add_action( 'show_user_profile', [ $self, 'render' ] );
		add_action( 'edit_user_profile', [ $self, 'render' ] );
		add_action( 'personal_options_update', [ $self, 'save' ] );
		add_action( 'edit_user_profile_update', [ $self, 'save' ] );
	}

	public function render( $user ) {
		$registry  = new LanguageRegistry();
		$languages = $registry->all( true );
		if ( count( $languages ) <= 1 ) {
			return;
		}
		$current = (string) get_user_meta( $user->ID, self::META_KEY, true );
		$default = Context::default_code();
		?>
		<h2><?php esc_html_e( 'GemTranslate', 'gemtranslate' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th><label for="gtrans_preferred_language"><?php esc_html_e( 'Admin language', 'gemtranslate' ); ?></label></th>
				<td>
					<select name="gtrans_preferred_language" id="gtrans_preferred_language">
						<option value=""><?php esc_html_e( 'Site default', 'gemtranslate' ); ?> (<?php echo esc_html( $default ); ?>)</option>
						<?php foreach ( $languages as $lang ) : ?>
							<?php if ( $lang['code'] === $default ) { continue; } ?>
							<option value="<?php echo esc_attr( $lang['code'] ); ?>" <?php selected( $current, $lang['code'] ); ?>>
								<?php echo esc_html( $lang['name'] ); ?> (<?php echo esc_html( $lang['code'] ); ?>)
							</option>
						<?php endforeach; ?>
					</select>
					<p class="description"><?php esc_html_e( 'Translates the WordPress admin UI for this user using GemTranslate string translations.', 'gemtranslate' ); ?></p>
				</td>
			</tr>
		</table>
		<?php
	}

	public function save( $user_id ) {
		if ( ! current_user_can( 'edit_user', $user_id ) ) {
			return;
		}
		$value = isset( $_POST['gtrans_preferred_language'] ) ? sanitize_key( wp_unslash( $_POST['gtrans_preferred_language'] ) ) : '';
		if ( '' === $value ) {
			delete_user_meta( $user_id, self::META_KEY );
			return;
		}
		if ( Context::is_active( $value ) ) {
			update_user_meta( $user_id, self::META_KEY, $value );
		}
	}
}

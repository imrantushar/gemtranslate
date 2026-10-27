<?php
namespace GemTranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-user language assignment. A user with the `gtrans_translate_content`
 * cap can only operate on languages listed in their `gtrans_assigned_languages`
 * user meta. Admins (manage_options) bypass the scope entirely.
 *
 * Storage: user meta `gtrans_assigned_languages` is an array of language
 * codes. An empty array means "all languages" (unrestricted translator).
 */
class LanguageScope {

	const META_KEY = 'gtrans_assigned_languages';

	/**
	 * Return the language codes a user is authorized to translate.
	 * Empty array means unrestricted (all active languages).
	 */
	public static function for_user( $user_id ) {
		$value = get_user_meta( (int) $user_id, self::META_KEY, true );
		if ( ! is_array( $value ) ) {
			return [];
		}
		return array_values( array_filter( array_map( 'strtolower', $value ) ) );
	}

	public static function set_for_user( $user_id, array $codes ) {
		$codes = array_values( array_unique( array_filter( array_map( 'strtolower', $codes ) ) ) );
		update_user_meta( (int) $user_id, self::META_KEY, $codes );
	}

	/**
	 * Can the current user translate the given language?
	 *
	 * - Admins (manage_options) can translate anything.
	 * - Otherwise, the user must have `gtrans_translate_content` AND either
	 *   no scope set (unrestricted) or the language in their scope.
	 */
	public static function can_translate( $language_code ) {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		if ( ! current_user_can( 'gtrans_translate_content' ) ) {
			return false;
		}
		$scope = self::for_user( get_current_user_id() );
		if ( empty( $scope ) ) {
			return true; // unrestricted translator
		}
		return in_array( strtolower( $language_code ), $scope, true );
	}
}

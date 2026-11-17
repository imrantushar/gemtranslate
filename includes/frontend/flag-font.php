<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Makes flag emoji render as real flags everywhere.
 *
 * Windows ships no flag glyphs, so a flag emoji there shows up as two letters
 * ("GB", "BD"). This bundles the "Twemoji Country Flags" font (CC-BY 4.0, see
 * assets/fonts/README-flags.txt) and applies it to the switchers' flag spans
 * only. The font is limited to the regional-indicator range, so the browser
 * downloads it only when a flag is actually on the page.
 */
class FlagFont {

	const FAMILY = 'GemTranslate Flags';

	private static $printed = false;

	/**
	 * @return string `<style>` block, or '' if it was already printed.
	 */
	public static function style_tag() {
		if ( self::$printed ) {
			return '';
		}
		self::$printed = true;
		return '<style id="gtrans-flag-font">' . self::css() . '</style>';
	}

	public static function css() {
		$url = esc_url( GTRANS_ASSETS_URI . 'fonts/TwemojiCountryFlags.woff2?ver=' . GTRANS_VERSION );
		return '@font-face{font-family:"' . self::FAMILY . '";'
			. 'unicode-range:U+1F1E6-1F1FF,U+1F3F4,U+E0062-E0063,U+E0065,U+E0067,U+E006C,U+E006E,U+E0073-E0074,U+E0077,U+E007F;'
			. 'src:url("' . $url . '") format("woff2");font-display:swap}'
			. '.gtrans-float__flag,.gtrans-switcher-flag{font-family:"' . self::FAMILY . '","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}';
	}
}

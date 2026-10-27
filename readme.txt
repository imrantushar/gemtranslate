=== GemTranslate ===
Contributors: gemtranslate
Tags: multilingual, translation, ai, i18n, woocommerce
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-3.0+
License URI: http://www.gnu.org/licenses/gpl-3.0.txt

AI-first multilingual platform for WordPress. Fast, modern, and developer-friendly.

== Description ==

GemTranslate is a performance-minded multilingual plugin for WordPress with a fully React-based admin, REST-driven architecture, and optional AI translation (OpenAI / DeepL / Google) via BYOK.

Designed to never slow down your site:
* Translations stored in custom tables, not duplicated in wp_posts.
* Single-query preload per request, cached via WordPress object cache.
* Default-language requests do zero extra work — filters short-circuit.
* Subdirectory URLs (/es/, /fr/) cache cleanly with WP Rocket, W3TC, LiteSpeed Cache, and Cloudflare APO.

== Installation ==

1. Upload the `gemtranslate` folder to `/wp-content/plugins/`.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Visit GemTranslate in the admin sidebar to configure languages.

== Changelog ==

= 1.0.0 =
* Initial release: language registry, REST API, admin shell.

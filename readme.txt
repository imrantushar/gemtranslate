=== GemTranslate ===
Contributors: kodezen, tusharimran
Tags: multilingual, translation, language switcher, i18n, woocommerce
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Fast, modern multilingual plugin for WordPress with a React admin, subdirectory language URLs and translations stored outside wp_posts.

== Description ==

GemTranslate is a performance-minded multilingual plugin for WordPress with a fully React-based admin and a REST-driven architecture.

= Built to stay fast =

* Translations are stored in custom tables, not duplicated in `wp_posts`.
* Single-query preload per request, cached through the WordPress object cache.
* Default-language requests do zero extra work: filters short-circuit.
* Subdirectory URLs (`/es/`, `/fr/`) cache cleanly with page-cache plugins and CDNs.

= Languages and URLs =

* Language manager with default language, RTL support and one-click presets.
* Subdirectory URL routing without adding rewrite rules.
* Optional browser-language redirect that skips search-engine bots.
* hreflang and SEO-friendly markup.

= Content translation =

* Translate posts, pages and custom post types, including block-aware translation of Gutenberg content.
* Translate taxonomy terms, navigation menu items, custom fields (ACF aware) and theme/plugin strings.

= Language switcher =

* Available as a shortcode, a block and a classic widget.
* Optional floating switcher.

= Workflow and tools =

* Import from Polylang, and import/export of translations.
* Translator roles with per-post assignments.

= For developers =

* WP-CLI commands.
* A documented REST API and hook set.

= GemTranslate Pro =

GemTranslate Pro is a separate add-on that adds automation, WooCommerce support, advanced SEO and team features.

== Installation ==

1. Upload the `gemtranslate` folder to `/wp-content/plugins/`, or install it from the Plugins screen.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Open GemTranslate in the admin sidebar and add your languages.

== Frequently Asked Questions ==

= Does it duplicate my posts for every language? =

No. Translations live in their own tables and are applied on the fly, so your posts table stays small.

= Will it slow down my site? =

Requests in the default language skip all translation work. Other languages use a single cached lookup per request.

= Can I use it with a caching plugin? =

Yes. Each language has its own URL prefix, so page caches and CDNs store them separately.

= Is the admin source code available? =

Yes. See the "Source code" section below.

== Changelog ==

= 1.0.0 =
* Initial release: language registry, URL routing, post/term/menu/string translation, language switcher, REST API and React admin.

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== External services ==

When you use the "Import community translations" tool in GemTranslate, the plugin sends the slug of the plugin or theme you chose to the WordPress.org API (`api.wordpress.org`) to check whether it is hosted there, and links to translate.wordpress.org for its translation packs. No data is sent unless an administrator starts that tool. See the WordPress.org privacy policy: https://wordpress.org/about/privacy/

== Source code ==

The full, human-readable source code of GemTranslate is publicly available on GitHub: https://github.com/imrantushar/gemtranslate

The compiled admin app in `assets/build/` is built from the source in the `dev_gemtranslate/` folder of that repository. To build it, run `npm install` followed by `npm run build` (uses @wordpress/scripts, Tailwind and webpack; see `package.json`).

# Actions & filters

Hooks GemTranslate **fires** (for you to subscribe to) and ones it **subscribes to** (so you know where to intercept).

---

## Actions GemTranslate fires

| Hook | Args | When |
|---|---|---|
| `gtrans_loaded` | — | After `plugins_loaded`. Equivalent to `init`-time bootstrap. |
| `gtrans_before_init` | — | Just before the dispatcher chain runs. |
| `gtrans_init` | — | After every GemTranslate subsystem is initialised. |
| `gtrans_translation_saved` | `int $post_id` | When a translation row changes or a post is saved/deleted. Cache bridges subscribe to this. |
| `gtrans_language_changed` | `string $event, string $code` | After `LanguageRegistry::insert / update / delete / set_default`. `$event` is one of `inserted`, `updated`, `deleted`, `default_set`. Cache bridges subscribe to this. |
| `gtrans_run_translation_job` | `array $args` | Internal — Action Scheduler / WP-Cron callback for the async queue. |

### Example: trigger an external cache purge

```php
add_action( 'gtrans_translation_saved', function ( $post_id ) {
    my_external_cdn_purge( $post_id );
} );
```

---

## Filters GemTranslate hooks into

The plugin doesn't add new filters of its own for content (yet), but it **subscribes** to a wide set of WordPress filters. If you write a plugin that returns content via these filters, your translations flow through GemTranslate automatically.

### Post content
- `the_title`
- `the_content`
- `the_excerpt`
- `get_the_excerpt`
- `single_post_title`

### Terms
- `get_term`
- `get_terms`
- `single_term_title`

### Menus
- `wp_nav_menu_objects`

### URLs (only translated on non-default languages)
- `home_url`
- `network_home_url`
- `post_link`
- `page_link`
- `post_type_link`
- `term_link`
- `attachment_link`

### Gettext (string translation runtime)
- `gettext`
- `gettext_with_context`
- `ngettext`

### Post meta
- `get_post_metadata`

### SEO (only when the plugin is active)
- `wpseo_title`, `wpseo_metadesc`, `wpseo_opengraph_title`, `wpseo_opengraph_desc`, `wpseo_canonical` (Yoast)
- `rank_math/frontend/title`, `rank_math/frontend/description`, `rank_math/opengraph/facebook/og_title`, `rank_math/opengraph/facebook/og_description`, `rank_math/frontend/canonical` (Rank Math)
- `wp_sitemaps_posts_entry`, `wp_sitemaps_taxonomies_entry` (Core sitemaps)

### WooCommerce (only when active)
- `woocommerce_product_get_name`
- `woocommerce_product_get_description`
- `woocommerce_product_get_short_description`
- `woocommerce_product_variation_get_name`
- `woocommerce_product_variation_get_description`

### Routing
- `parse_request` (priority 0)
- `wp_head` (for `<link rel="alternate" hreflang>`)
- `template_redirect` (for browser-language auto-redirect)
- `admin_bar_menu` (for the 🌐 admin-bar switcher)

### Locale (per-user admin language)
- `locale`
- `plugin_locale`

### Email
- `wp_mail` (translates per recipient when `translate_emails` is on)

### REST
- `rest_api_init` (route registration)

### Save / delete
- `save_post` (invalidates caches, recomputes `source_hash`)
- `before_delete_post`

---

## Capabilities

GemTranslate adds a single capability:

```
gtrans_translate_content
```

Granted to `administrator` and `editor` roles on activation (and backfilled on `init` once via the `gtrans_caps_granted` option). Custom role `gtrans_translator` is also registered with just `read` + this cap.

### Granting / revoking programmatically

```php
get_role( 'shop_manager' )->add_cap( 'gtrans_translate_content' );
get_role( 'editor' )->remove_cap( 'gtrans_translate_content' );
```

### Per-user language scope

User meta `gtrans_assigned_languages` is an array of language codes. Empty = unrestricted; populated = only those languages.

```php
update_user_meta( $user_id, 'gtrans_assigned_languages', [ 'es', 'pt-br' ] );
```

The REST layer enforces this scope via `LanguageScope::can_translate( $code )`.

---

## Options used

| Option | Purpose |
|---|---|
| `gtrans_settings` | JSON blob with all admin settings (see [FEATURES.md §27](FEATURES.md#27-settings)). |
| `gtrans_ai_providers` | JSON config for AI providers (default + per-provider creds, redacted on read). |
| `gtrans_version` | Plugin version stamp. |
| `gtrans_db_version` | Schema version — bumped to run migrations. |
| `gtrans_first_install_time` | Set once at activation. |
| `gtrans_required_rewrite_flush` | Scheduling flag for `flush_rewrite_rules()` on the next `init`. |
| `gtrans_caps_granted` | One-shot flag — caps backfilled. |

## User meta keys

| Key | Purpose |
|---|---|
| `gtrans_preferred_language` | The user's chosen admin language. |
| `gtrans_assigned_languages` | Translator's language scope. |

## Post meta keys

| Key | Purpose |
|---|---|
| `_gtrans_group_id` | Translation group ID for a post. |
| `_gtrans_source_lang` | Language the post was originally authored in. |
| `_gtrans_source_hash` | MD5 of source `title \x1f content \x1f excerpt` — used for stale detection. |

## Cache groups (object cache)

| Group | What's cached |
|---|---|
| `gtrans_languages` | Language list and default-language row. |
| `gtrans_translations` | Per-post per-language translation rows. |
| `gtrans_term_translations` | Per-term per-language translation rows. |
| `gtrans_strings` | UI string-translation map. |

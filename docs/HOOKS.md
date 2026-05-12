# Actions & filters

Hooks Zentranslate **fires** (for you to subscribe to) and ones it **subscribes to** (so you know where to intercept).

---

## Actions Zentranslate fires

| Hook | Args | When |
|---|---|---|
| `ztrans_loaded` | — | After `plugins_loaded`. Equivalent to `init`-time bootstrap. |
| `ztrans_before_init` | — | Just before the dispatcher chain runs. |
| `ztrans_init` | — | After every Zentranslate subsystem is initialised. |
| `ztrans_translation_saved` | `int $post_id` | When a translation row changes or a post is saved/deleted. Cache bridges subscribe to this. |
| `ztrans_language_changed` | `string $event, string $code` | After `LanguageRegistry::insert / update / delete / set_default`. `$event` is one of `inserted`, `updated`, `deleted`, `default_set`. Cache bridges subscribe to this. |
| `ztrans_run_translation_job` | `array $args` | Internal — Action Scheduler / WP-Cron callback for the async queue. |

### Example: trigger an external cache purge

```php
add_action( 'ztrans_translation_saved', function ( $post_id ) {
    my_external_cdn_purge( $post_id );
} );
```

---

## Filters Zentranslate hooks into

The plugin doesn't add new filters of its own for content (yet), but it **subscribes** to a wide set of WordPress filters. If you write a plugin that returns content via these filters, your translations flow through Zentranslate automatically.

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

Zentranslate adds a single capability:

```
ztrans_translate_content
```

Granted to `administrator` and `editor` roles on activation (and backfilled on `init` once via the `ztrans_caps_granted` option). Custom role `ztrans_translator` is also registered with just `read` + this cap.

### Granting / revoking programmatically

```php
get_role( 'shop_manager' )->add_cap( 'ztrans_translate_content' );
get_role( 'editor' )->remove_cap( 'ztrans_translate_content' );
```

### Per-user language scope

User meta `ztrans_assigned_languages` is an array of language codes. Empty = unrestricted; populated = only those languages.

```php
update_user_meta( $user_id, 'ztrans_assigned_languages', [ 'es', 'pt-br' ] );
```

The REST layer enforces this scope via `LanguageScope::can_translate( $code )`.

---

## Options used

| Option | Purpose |
|---|---|
| `ztrans_settings` | JSON blob with all admin settings (see [FEATURES.md §27](FEATURES.md#27-settings)). |
| `ztrans_ai_providers` | JSON config for AI providers (default + per-provider creds, redacted on read). |
| `ztrans_version` | Plugin version stamp. |
| `ztrans_db_version` | Schema version — bumped to run migrations. |
| `ztrans_first_install_time` | Set once at activation. |
| `ztrans_required_rewrite_flush` | Scheduling flag for `flush_rewrite_rules()` on the next `init`. |
| `ztrans_caps_granted` | One-shot flag — caps backfilled. |

## User meta keys

| Key | Purpose |
|---|---|
| `ztrans_preferred_language` | The user's chosen admin language. |
| `ztrans_assigned_languages` | Translator's language scope. |

## Post meta keys

| Key | Purpose |
|---|---|
| `_ztrans_group_id` | Translation group ID for a post. |
| `_ztrans_source_lang` | Language the post was originally authored in. |
| `_ztrans_source_hash` | MD5 of source `title \x1f content \x1f excerpt` — used for stale detection. |

## Cache groups (object cache)

| Group | What's cached |
|---|---|
| `ztrans_languages` | Language list and default-language row. |
| `ztrans_translations` | Per-post per-language translation rows. |
| `ztrans_term_translations` | Per-term per-language translation rows. |
| `ztrans_strings` | UI string-translation map. |

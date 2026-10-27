# Architecture

How a frontend request flows through GemTranslate, where caches sit, why translations are fast.

---

## Request lifecycle (frontend, non-default language)

```
Browser → /es/sample-page/

1. parse_request (priority 0)
   └─ RequestParser strips "es/" from $wp->request
   └─ Context::set('es')                          ← per-request language state
   └─ $_SERVER['REQUEST_URI'] rewritten to /sample-page/

2. WP runs its rewrite-rule matcher against the (now language-less) URI.
   The plugin adds NO rewrite rules — WP's normal routing handles everything.

3. `wp` action: TranslationLoader::preload($queried_object)
   └─ One SELECT against wp_gtrans_post_translations
      (covered by PRIMARY KEY (group_id, language_code))
   └─ Result cached in wp_cache group `gtrans_translations`,
      key `{group_id}:{lang}`, 24h TTL

4. Content filters fire:
   ├─ the_title       → swap from preloaded row (O(1) memo lookup)
   ├─ the_content     → swap from preloaded row
   ├─ the_excerpt     → swap from preloaded row
   ├─ get_term[s]     → 1 query for the page's terms, memoized
   ├─ wp_nav_menu_objects → 1 query for all items in the menu
   └─ gettext         → in-memory hash table loaded once per request

5. URL filters fire:
   ├─ home_url / post_link / page_link / term_link → prepend "/es"
   └─ Skip when Context::is_default() — zero cost on default-lang requests

6. wp_head: HreflangOutput emits <link rel="alternate" hreflang> tags
   for every active language plus x-default.

7. Page-cache plugin (WP Rocket / W3TC / LiteSpeed / Cloudflare) stores the
   final HTML keyed by URL. /es/sample-page/ and /sample-page/ are distinct
   keys, so subsequent hits serve from cache with zero PHP.
```

## Performance budget

| Request type | Extra queries (vs no plugin) |
|---|---|
| Default-language frontend, cold | **0** — every filter short-circuits on `Context::is_default()` |
| Non-default frontend, cold + no object cache | **≤ 3** — one for the post translation set, one for term translations on the page, one for the gettext string map |
| Non-default frontend, cold + Redis object cache | **0** on subsequent requests within TTL |
| Non-default frontend, page-cache hit (any plugin) | **0 PHP** — served from disk |
| Non-default admin / REST | varies — admin paths short-circuit routing entirely |

## Cache layers

There are three levels of caching, all flushed on writes:

1. **Per-request memo** (`TranslationLoader::$memo`, `TermTranslator::$memo`, etc.) — same PHP process never queries twice for the same key.
2. **Object cache** (`wp_cache_*`) — cross-request, default 24h TTL. Works with Redis / Memcached / Object Cache Pro.
3. **Page cache** (your cache plugin) — final HTML cached per URL.

Writes invalidate all three:
- `save_post` → `TranslationLoader::invalidate_post()` clears the request memo + object cache.
- `gtrans_translation_saved` action → cache-plugin bridges purge.
- Language CRUD → `Context::flush()` clears the active-language map.

## Storage strategy

```
        wp_posts (untouched)
            ▲
            │ post_id reference
            │
wp_gtrans_post_translations
   group_id (FK → translation_groups)
   language_code
   title / content / excerpt / slug / status
   source_hash               ← stale-detection
   updated_at
```

- **One canonical post** lives in `wp_posts`. WP_Query never sees translation rows.
- **Translations** live in `wp_gtrans_post_translations`, keyed by `(group_id, language_code)`.
- **No JOINs** — translation lookup is a single PK index hit per post.
- **Post meta translations** mirror this pattern in `wp_gtrans_post_meta_translations`.

This is the headline performance choice. WPML duplicates posts into `wp_posts`; Polylang duplicates and adds a taxonomy link; both inflate `wp_posts` linearly with language count. GemTranslate keeps `wp_posts` flat and stores translation deltas separately.

## Dispatcher chain

```
gemtranslate.php (root)
  GemTranslate::__construct()
    define_constants()
    set_global_settings()
    load_dependency()           ← autoloader + functions + hooks
    register_activation_hook()
    add_action('plugins_loaded') → on_plugins_loaded() → do_action('gtrans_loaded')
    add_action('gtrans_loaded')  → init_plugin() → dispatch_hooks():

      GemTranslate\Database::init()         (rewrite-flush scheduler)
      GemTranslate\Language::init()         (lightweight)
      GemTranslate\Routing::init()          (RequestParser + UrlRewriter + BrowserRedirect)
      GemTranslate\Translation::init()      (Post/Term/Menu/String/Meta translators)
      GemTranslate\SEO::init()              (Hreflang + Sitemap + Yoast + RankMath)
      GemTranslate\AI::init()               (JobRunner)
      GemTranslate\Cache::init()            (Invalidator)
      GemTranslate\Compat::init()           (Woo + WP Rocket + W3TC + LiteSpeed + Cloudflare)
      GemTranslate\API::init()              (12 REST controllers under gtrans/v1)
      GemTranslate\Assets::init()           (script enqueue + block-editor enqueue)
      GemTranslate\Frontend::init()         (shortcode + Gutenberg block + widget)
      GemTranslate\Admin::init()            (menu + bar + profile + Localizer + MailLocalizer)
      GemTranslate\Multisite::init()        (wp_initialize_site / wpmu_new_blog)
      GemTranslate\Cli::init()              (WP-CLI commands when WP_CLI is set)
```

## Autoloader

Custom Academy-style autoloader at `includes/autoload.php`:

- Root namespace `GemTranslate` → `includes/`
- `GemTranslate\Foo\BarBaz` → `includes/foo/bar-baz.php`
- CamelCase → kebab-case; `\` → `/`; lowercase
- No Composer required

Side benefit: every class lives in its own file, named predictably.

## React admin

- **Entry**: `dev_gemtranslate/index.jsx` mounts into `#gemtranslate-admin-root`.
- **Routing**: `HashRouter` so deep links work without server-side rewrite rules.
- **Data layer**: TanStack Query — cache, optimistic updates, refetch-on-mutation.
- **Styling**: Tailwind v3 with `ztrans-` prefix and `important: '#gemtranslate-admin-root'` so utilities only apply inside our subtree (no WP-admin style bleed).
- **i18n**: `@wordpress/i18n` for `__()` / `sprintf`. `wp_set_script_translations` loads the per-locale JSON when a translation pack exists.

## Build pipeline

- `@wordpress/scripts` → webpack.
- Two entries: `backend` (full admin) and `editor` (Gutenberg sidebar plugin).
- PostCSS pipeline: Tailwind + autoprefixer.
- Versioned filenames: `[name].1.0.0.js` for cache-busting.
- WordPress dependencies (`react`, `react-dom`, `wp-i18n`, `wp-element`, `wp-edit-post`, `wp-plugins`, `wp-data`, `wp-components`) auto-detected and externalised — they come from WordPress's bundled libraries at runtime, keeping our bundles tiny.

## Async job queue

```
React UI / WP-CLI / REST
    │
    ▼
JobRunner::queue_translate_post( $post_id, $lang )
    │
    │ insert into wp_gtrans_jobs (status=pending)
    │
    ▼
Dispatch:
   ┌── if as_enqueue_async_action exists → Action Scheduler
   └── else                              → wp_schedule_single_event (cron)
    │
    ▼
JobRunner::run( $job_id )           ← idempotent on double-fire
    │
    │ Mark running
    │ TranslationMemory::get for each text (skip if cached)
    │ Translator::translate(remaining)
    │ TranslationMemory::set on each result
    │ TranslationLoader::save_translation
    │
    ▼
Mark success or schedule retry (linear backoff, max 3 attempts)
```

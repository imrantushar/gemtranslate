# GemTranslate — Feature catalogue

Every capability the plugin ships with. Grouped by area for fast scanning.

---

## 1. Languages

- **Custom languages table** (`wp_gtrans_languages`) — no taxonomy hacks, plain SQL row per language.
- **Fields per language**: code (`en`, `pt-br`), locale (`en_US`, `pt_BR`), English name, native name, flag code, RTL flag, default flag, active flag, sort position.
- **Default language** is the site's WP locale on first install. Switch any time.
- **RTL support** — switcher emits `dir="rtl"`-ready markup; auto-loaded `backend-rtl.css` for the admin UI.
- **Object-cached registry** — language list cached in `wp_cache` group `gtrans_languages`, flushed on CRUD writes.
- **Active / inactive toggle** — hide a language from the switcher without losing its translations.
- **REST CRUD**: `GET / POST / PATCH / DELETE` under `/languages/`, plus `/languages/{code}/default`.
- **Onboarding presets**: 10 ready-to-use languages (Spanish, French, German, Italian, Portuguese-BR, Japanese, Chinese-CN, Arabic, Hindi, Bengali) one-click in the setup wizard.

## 2. URL routing

- **Subdirectory strategy** — `example.com/es/sample-page/`, `example.com/fr/…`. Default language stays at the root.
- **Zero-rewrite-rule design** — `parse_request` hook strips the language prefix and sets the request URI before WordPress's matcher runs, so no rewrite rules need flushing and no rule-table bloat.
- **URL rewriter** — filters `home_url`, `network_home_url`, `post_link`, `page_link`, `post_type_link`, `term_link`, `attachment_link` to prepend `/{lang}/` for non-default languages. Short-circuits on default language for zero cost.
- **Skips admin / REST / cron paths** so language-aware code never interferes with internal URLs.

## 3. Language switcher

- **Shortcode**: `[gemtranslate_language_switcher display=inline|dropdown show_flag=1 show_name=1 show_native=0]`.
- **Gutenberg block**: `gemtranslate/language-switcher` — server-rendered, all four attributes editable in the inspector.
- **WP_Widget**: classic widget for legacy themes, with title + display + flag/name/native toggles.
- **Emoji flags** — auto-derived from country code (BG → 🇧🇬, ES → 🇪🇸); falls back to plain code when no mapping exists.
- **hreflang + lang attributes** on every link for accessibility.
- **`aria-current="true"`** on the active language.

## 4. Browser-language auto-redirect

- **Opt-in setting** (`auto_redirect_browser_lang`).
- **Accept-Language parsing** with q-value sorting.
- **Exact + short-code fallback** (visitor's `en-US` matches site `en`).
- **Cookie persistence** — `gtrans_user_lang` survives 30 days.
- **Bot detection** — skips Googlebot, Bingbot, facebookexternalhit, DuckDuckBot, etc. to keep SEO clean.
- **Fires once per visitor** — no redirect loops; respects manual switches.

## 5. Post / page translation

- **Translation tables, not duplicate posts** — `wp_gtrans_post_translations` keyed on `(group_id, language_code)`.
- **TranslationGroups** link variants across languages via `_gtrans_group_id` post meta.
- **Single-query preload** per request: `SELECT * FROM wp_gtrans_post_translations WHERE group_id = ? AND language_code = ?`.
- **Two cache layers**: object cache (cross-request, group `gtrans_translations`, 24h TTL) + per-request memo.
- **Content filters**: `the_title`, `the_content`, `the_excerpt`, `get_the_excerpt`, `single_post_title` — all short-circuit on the default language.
- **Auto-invalidation** on `save_post` and `before_delete_post`.
- **`source_hash` stale detection** — translations marked "stale" in the UI when the source post changes after they were saved.
- **Status pills**: `translated`, `pending`, `stale`, `missing`.
- **REST**: paginated list, per-post translation set, save / delete translation, dynamic public post types.

### 5a. Block-aware translation

- **Gutenberg block parser** (`includes/translation/block-parser.php`) walks `parse_blocks()` output and yields a flat list of fields, each with a path (`0.innerHTML`, `1.attrs.alt`, …).
- **innerHTML + attribute fields**: paragraph, heading, list, quote, button, image (`alt`, `caption`), cover (`alt`), gallery, media-text, embed, file, etc.
- **innerBlocks** traversed recursively.
- **Rewrite pass** — applies translations back to the same paths and uses `serialize_blocks` to produce a valid block document.
- **Per-block AI button** + "Translate all blocks with AI".

### 5b. Custom fields & ACF

- **`wp_gtrans_post_meta_translations`** table.
- **`get_post_metadata` filter** swaps values when current language is non-default and a translation exists.
- **ACF auto-detect** — `get_field_objects()` is consulted for human-readable labels.
- **Internal keys skipped** — `_gtrans_*`, `_edit_*`, `_wp_*`, ACF field-key refs (underscore-prefixed).
- **REST + UI tab** for editing meta translations per language.

### 5c. Translation history / revisions

- **`wp_gtrans_post_translation_revisions`** table.
- **Auto-snapshot on save** — the previous row is captured before being overwritten.
- **Up to 20 revisions per (post, language)** kept; older entries pruned automatically.
- **REST**: list, show, diff, revert.
- **UI tab** — clickable revision list + preview pane + "Revert to this revision" with confirm.

## 6. Term translation

- **`wp_gtrans_term_translations`** table — keyed on `(group_id, language_code)`.
- **Filters**: `get_term`, `get_terms`, `single_term_title`.
- **Per-term fields**: name, description, slug.
- **Cross-language linkage** via `_gtrans_group_id` term meta.
- **REST CRUD** + dedicated Taxonomies UI page.

## 7. Menu translation

- **`wp_gtrans_menu_translations`** table — keyed on `(menu_item_id, language_code)`.
- **`wp_nav_menu_objects` filter** — one query per menu for the whole list.
- **Translatable fields**: item title + URL override.
- **REST**: list menus, list items, save per item.

## 8. String translation

- **`wp_gtrans_strings` + `wp_gtrans_string_translations`** tables.
- **Runtime override**: `gettext`, `gettext_with_context`, `ngettext` filters.
- **O(1) lookups** from an in-memory hash table loaded once per request.
- **String scanner** walks any directory and registers every `__()` / `_e()` / `esc_html__()` / `_x()` / `_ex()` / `esc_html_x()` call via PHP's `token_get_all` (never executes the scanned code).
- **Targets**: active theme, all plugins, custom absolute path.
- **Domain filter, search, pagination** in the UI.
- **Bulk save** REST endpoint.

## 9. SEO

- **hreflang tags** emitted in `<head>` for every active language + `x-default` pointing to the default-language URL.
- **Locale-style hreflang** (`pt-BR` over `pt`) when the language has a region.
- **Core sitemap integration** — `wp_sitemaps_*_entry` filters add `xhtml:link` alternate entries per entity.
- **Yoast SEO bridge** — `wpseo_title`, `wpseo_metadesc`, `wpseo_opengraph_*`, `wpseo_canonical` filtered when Yoast is active.
- **Rank Math bridge** — `rank_math/frontend/title`, `rank_math/frontend/description`, `rank_math/opengraph/facebook/og_*`, `rank_math/frontend/canonical` filtered when Rank Math is active.
- **Per-translation SEO meta**: `meta_title`, `meta_desc`, `og_title`, `og_desc`, `canonical_override`.
- **REST + SEO tab** in the post translation editor with AI button per field.

## 10. WooCommerce

- **Product title / description / short description** translated via `woocommerce_product_get_*` filters.
- **Variation getters** translated via `woocommerce_product_variation_get_*`.
- **No duplicate products** — uses the same `wp_gtrans_post_translations` rows as regular posts.
- **Hooks load only when WooCommerce is active.**

## 11. AI translation (BYOK + Cloud)

- **`TranslatorInterface`** — uniform contract: `translate(texts, source, target, context) -> { translations, provider, model }`.
- **Four providers shipped**:
  - **OpenAI** — Chat Completions, configurable model (default `gpt-4o-mini`), strict system prompt for delimiter-preserving batch output, HTML/markdown preservation.
  - **DeepL** — free and pro endpoints, `tag_handling=html`, `preserve_formatting=1`.
  - **Google Cloud Translation v2** — API-key auth, HTML format toggle.
  - **GemTranslate Cloud** — hosted proxy contract (Bearer license key, `/translate` and `/ping` endpoints). Plugin ships the client; you host the proxy.
- **Translator factory** (`TranslatorFactory`) reads `gtrans_ai_providers` JSON option, redacts keys on read.
- **Test credentials** button per provider — does a real round-trip to validate.
- **Inline key support** — test a provider with an unsaved key.
- **Translation Memory** (`wp_gtrans_translation_memory`):
  - SHA-256 hash of `source + source_lang + target_lang`.
  - Hit-count tracked.
  - Per-provider attribution.
  - Stats endpoint (`entries`, `hits`).
- **Glossary** (`wp_gtrans_glossary`):
  - Brand terms / proper nouns per language pair.
  - Case-sensitive flag.
  - Do-Not-Translate flag.
  - Pre-passed into provider prompt as a `glossary` context block.
- **REST**: providers list / save / test, translate (single + batch), glossary CRUD, memory stats.

## 12. Async job queue

- **`wp_gtrans_jobs`** table + Action Scheduler integration (`as_enqueue_async_action`) with **WP-Cron fallback** when AS isn't installed.
- **Idempotent** — double-fired runs skip already-completed jobs.
- **Retry with linear backoff** — up to 3 attempts, then permanent failure with error stored.
- **Job types**: `post_translate`.
- **Single + bulk enqueue** REST endpoints.
- **Jobs UI** with status filter, retry, delete, and live polling every 3s while pending/running.
- **Sidebar badge** showing live job count in the React app.
- **Bulk-translate on the Posts page** — select N posts × M languages × overwrite toggle → enqueues N×M jobs.

## 13. Self-translation of the plugin admin

- **POT parser** (minimal `msgid` / `msgstr` / `msgctxt` reader).
- **PO writer** with reference comments + locale headers.
- **MO writer** (Gettext binary format from scratch).
- **JSON writer** for `wp_set_script_translations` lookups.
- **`PackGenerator`** — reads `languages/gemtranslate.pot`, batches every untranslated msgid through the configured AI provider, writes the four files to `languages/`.
- **TM-aware** — already-translated entries skip the API call.
- **Glossary-aware** — passes the pairs map to the provider.
- **REST**: status, generate, delete.
- **UI page**: "Plugin translations" with one-click generation per locale.

## 14. React + Tailwind admin

- **Stack**: React 18, `@wordpress/scripts`, TanStack Query, React Router (HashRouter), Tailwind v3 (`ztrans-` prefix, scoped via `important: '#gemtranslate-admin-root'`).
- **All pages** wired and live:
  1. **Dashboard** — stats cards (active languages, translated posts, strings, TM entries) + per-language coverage + language list.
  2. **Languages** — full CRUD with preset chips, RTL/active toggles, set-default action.
  3. **Posts & Pages** — paginated table, dynamic public CPTs, per-language status pills, bulk-select, "Translate selected with AI", search.
  4. **Translation Editor** — tabbed: **Content | Blocks | Fields | SEO | History**.
  5. **Taxonomies** — search + edit per term per language with AI assist.
  6. **Strings** — search, domain filter, target-language selector, scan active theme / all plugins, inline edit + AI per row.
  7. **Menus** — per-menu, per-language item editor with URL override.
  8. **SEO** — informational + per-post overrides via the SEO tab in the post editor.
  9. **AI Translation** — provider cards (OpenAI / DeepL / Google / Cloud), test credentials, TM stats.
  10. **Glossary** — add brand terms / DNT entries, language-pair scoping.
  11. **Jobs** — async queue monitor with counts, retry, delete, status filter, live polling.
  12. **Plugin translations** — generate AI packs for the plugin admin in any active language.
  13. **Translators** — list users with the cap, assign per-user language scope.
  14. **Migration** — three detect+import cards (WPML / Polylang / TranslatePress).
  15. **Import & Export** — XLIFF 2.1 / CSV for strings or posts.
  16. **Settings** — URL strategy, display, performance, danger zone, visitor experience.
  17. **Onboarding** — 4-step wizard for first-time setup.

### 14a. i18n

- **All user-facing strings** wrapped in `__()` / `sprintf()` from `@wordpress/i18n`.
- **`wp_set_script_translations`** wired in `Assets::enqueue_admin`.
- **403 translatable strings** extracted to `languages/gemtranslate.pot`.

### 14b. Components

- `PageHeader`, `Card`, `Button`, `Input` (with `Field`, `TextInput`, `TextArea`, `Select`, `Checkbox`), `Modal`, `Toast`, `Spinner` + `LoadingBlock`, `StatusPill`, `Sidebar`, `LanguagePicker`, `Layout`.

## 15. Per-user admin language

- **User meta**: `gtrans_preferred_language`.
- **WP user-profile picker** — drops into Users → Your Profile.
- **Admin bar 🌐 dropdown** — one-click switch, nonce-protected.
- **React sidebar `LanguagePicker`** — same behaviour, in-app.
- **Localizer**: filters WordPress `locale` + `plugin_locale` in admin to the user's preferred locale — pulls the whole admin UI (core, plugins, themes, GemTranslate React) into the chosen language.
- **REST**: `GET / PUT /me/language` (logged-in users only).

## 16. Translator role + language scope

- **Custom role**: `gtrans_translator`.
- **Capability**: `gtrans_translate_content` — granted to `administrator` + `editor` on activation (idempotent backfill on `init`).
- **Per-user language scope** (`gtrans_assigned_languages` user meta) — empty array means unrestricted; populated array means "only these languages".
- **Enforced in `permissions_translate`** — REST returns 403 when a route's `:lang` param isn't in the user's scope.
- **Translators UI** — list every cap-holder, tick languages, save.

## 17. Migration importers

- **WPML** — reads `icl_translations` (joined by `trid`) + `icl_languages`. Walks every group, links the source post to its translated siblings via our `TranslationLoader`.
- **Polylang** — reads `language` taxonomy + `post_translations` term descriptions (serialized `[lang_code => post_id]` arrays).
- **TranslatePress** — reads every `wp_trp_dictionary_*_*` table and registers each `(original, translated)` pair as a GemTranslate string + translation.
- **Detection** — checks for source plugin tables/taxonomies before running.
- **REST**: detect + import.
- **UI**: side-by-side cards with detection pill, run-import button, and result counts.

## 18. Onboarding wizard

- **4 steps**: welcome → languages → AI provider → done.
- **Quick language presets** — toggleable chips for the 10 most popular languages.
- **Inline AI test** — validates the provided key before saving.
- **Auto-redirect first-time users** from `/dashboard` to `/onboarding` (`onboarding_complete` setting).
- **Skippable** at every step.

## 19. Import & Export

- **XLIFF 2.1** — proper `xliff` / `file` / `unit` / `segment` / `source` / `target` markup; `srcLang` and `trgLang` on the root.
- **CSV** — RFC-4180 quoting, columns `id`, `source`, `target`, `note`.
- **Unit IDs**:
  - `string:<string_id>` for UI strings.
  - `post:<post_id>:<field>` (field = `title` | `content` | `excerpt`) for posts.
- **Export streams** with proper `Content-Disposition: attachment; filename="…"`.
- **Import** handles both formats automatically.

## 20. Gutenberg sidebar plugin

- **Separate webpack entry** — bundles into 3.3 KiB JS (most deps live in WP's bundled libraries).
- **Enqueued only on the block editor** (`enqueue_block_editor_assets`).
- **`PluginSidebar`** titled "GemTranslate" with a translation icon in the editor top-right.
- **Per-language status pill** for the current post.
- **"AI" button** queues a translation job inline — visible in the Jobs page seconds later.
- **"Edit" button** deep-links into the full GemTranslate translation editor.
- **Refresh button** for manual reload.

## 21. Transactional email locale switch

- **Opt-in** via `translate_emails` setting.
- **Hooks `wp_mail`** at priority 1 (before the message renders).
- **Resolves the primary recipient** → looks up `gtrans_preferred_language` user meta → maps to a WP locale.
- **Swaps WordPress `locale` for the send** + reloads `default` and `gemtranslate` textdomains so already-loaded translations refresh.
- **Restores on `wp_mail_succeeded` / `wp_mail_failed`** — stack-based so nested mails are safe.
- **Covers everything that funnels through `wp_mail`**: password reset, comment notifications, WooCommerce emails, plugin transactionals.

## 22. Cache plugin compatibility

- **WP Rocket** — `rocket_cache_dynamic_cookies` registers `gtrans_user_lang`; `rocket_clean_domain` on `gtrans_translation_saved` and `gtrans_language_changed`.
- **W3 Total Cache** — `w3tc_flush_all` on the same events.
- **LiteSpeed Cache** — `litespeed_purge_all` on the same events.
- **Cloudflare** — appends `Cookie` to the `Vary` header on every response.
- **Subdirectory URLs** mean every page-cache plugin keys per language automatically.
- **Object cache layer** (`TranslationCache`) — single read/write surface around `wp_cache_*` so Redis / Memcached caches everything for free.

## 23. Multisite

- **Auto-install on new sites** via `wp_initialize_site` (WP 5.1+) and legacy `wpmu_new_blog`.
- **Per-site default language** seeded from the new site's locale.
- **Cleanup on site delete** — `wp_uninitialize_site` drops tables when `remove_data_on_uninstall` is on for the deleted site.
- **Plays nicely** with both network-wide activation and per-site activation.

## 24. WP-CLI

Every command lives under `wp ztrans`:

- `languages list | add | remove | default`
- `pack list | generate <locale> | delete <locale>`
- `translate-all <lang> [--post-type=…] [--limit=…] [--overwrite]`
- `jobs status | clear`
- `memory`
- `strings scan <target>`
- `migrate <source>`

See [WP-CLI.md](WP-CLI.md) for full syntax.

## 25. REST API

42 endpoints under `/wp-json/gtrans/v1/`. See [REST-API.md](REST-API.md).

## 26. Performance architecture

- **No JOINs against `wp_posts`** — translation lookups never widen the main query.
- **1 query cold, 0 queries warm** per request to fetch translations.
- **Short-circuits everywhere** on the default language — `Context::is_default()` is the first line of every translation filter.
- **Object cache + per-request memo** prevent duplicate work within a single PHP process.
- **Subdirectory URLs** let any page-cache plugin serve translated pages with zero PHP after the first hit.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the request-pipeline walk-through.

## 27. Settings

| Key | Default | What it does |
|---|---|---|
| `url_strategy` | `subdirectory` | URL pattern. Subdomain / domain modes are v2. |
| `hide_default_lang_prefix` | `true` | Don't add `/en/` for the default language. |
| `show_switcher_for_default` | `true` | Include the default language in the switcher list. |
| `object_cache_enabled` | `true` | Use `wp_cache_*` for translation reads (recommended). |
| `debug_log_enabled` | `false` | Verbose logging to the WP debug log. |
| `remove_data_on_uninstall` | `false` | Drop all `wp_gtrans_*` tables + options on plugin delete. |
| `onboarding_complete` | `false` | Auto-redirects first-time users to `/onboarding`. |
| `auto_redirect_browser_lang` | `false` | First-visit redirect by `Accept-Language`. |
| `translate_emails` | `false` | Switch locale per recipient inside `wp_mail`. |

## 28. Database schema

14 tables, all prefixed `wp_gtrans_`:

| Table | Purpose |
|---|---|
| `languages` | Language registry. |
| `translation_groups` | Links translation variants across languages. |
| `post_translations` | Translated post fields. |
| `term_translations` | Translated taxonomy term fields. |
| `menu_translations` | Translated nav-menu items. |
| `strings` | Registered translatable strings. |
| `string_translations` | Translated string values. |
| `seo_meta` | Translated SEO meta per post/group. |
| `slugs` | Fast slug → object lookup for routing. |
| `jobs` | Async translation queue. |
| `translation_memory` | TM cache (SHA-256 keyed). |
| `glossary` | Brand terms / DNT entries. |
| `post_meta_translations` | Translated post meta / ACF fields. |
| `post_translation_revisions` | Per-translation revision history. |

Schema version stored in `gtrans_db_version` option (`1.2`); `Migrator::maybe_upgrade()` runs on `init` if behind.

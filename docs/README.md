# GemTranslate Documentation

AI-first multilingual platform for WordPress. Fast, modern, developer-friendly.

## Index

| File | What's inside |
|---|---|
| [FEATURES.md](FEATURES.md) | **Complete feature catalogue** — every capability the plugin ships with, organised by area. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How requests flow through the plugin, where caches sit, why it's fast. |
| [REST-API.md](REST-API.md) | Every REST endpoint with method, path, args, response shape, and required capability. |
| [WP-CLI.md](WP-CLI.md) | Every `wp ztrans …` command with options and examples. |
| [HOOKS.md](HOOKS.md) | PHP actions and filters GemTranslate fires and subscribes to — your extension points. |
| [../languages/README.md](../languages/README.md) | Translation pack workflow (POT → PO → MO → JSON). |

## At a glance

- **Subdirectory URLs** (`/es/`, `/fr/`) — cache cleanly with any page-cache plugin.
- **Translation tables, not post duplication** — single source post, translations stored separately.
- **1 query per request** to preload all translation fields for the current language, cached in WP object cache.
- **Filter-based content swap** — `the_title`, `the_content`, `the_excerpt`, `get_term`, `wp_nav_menu_objects`, `gettext`, plus WooCommerce / Yoast / RankMath bridges.
- **React + Tailwind admin** under `GemTranslate` in the WP sidebar.
- **REST-driven** with namespace `gtrans/v1`.
- **WP-CLI** for power users and CI.
- **Async AI translation** with Action Scheduler (WP-Cron fallback).
- **Self-translates its own admin** via your AI provider — no human translators needed for English-only origin sites.

## Plugin slug, namespaces, conventions

| Surface | Prefix |
|---|---|
| DB tables | `wp_gtrans_*` |
| Options | `gtrans_*` |
| Actions / filters | `gtrans_*` |
| Capabilities | `gtrans_translate_content` |
| Cache groups | `gtrans_*` |
| REST namespace | `gtrans/v1` |
| PHP root namespace | `GemTranslate\` |
| Constants | `GTRANS_*` |
| Tailwind prefix | `ztrans-` |

## Requirements

- WordPress 6.0+
- PHP 7.4+
- (Optional) Action Scheduler — for bulk AI job throughput
- (Optional) OpenAI / DeepL / Google API key — for AI translation
- (Optional) Object cache (Redis / Memcached) — for the warm-cache zero-query path

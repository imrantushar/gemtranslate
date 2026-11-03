# Plan: translate headers, footers, templates and patterns

Status: draft, nothing built yet.

## Goal
Text in site-wide layout pieces (header, footer, sidebars, synced patterns, navigation) shows
in the visitor's language, and can be translated in the same editors we already have for posts.

## What exists today (reuse, don't rebuild)
| Piece | File | What it gives us |
|---|---|---|
| Block text extraction / re-apply | `includes/translation/block-parser.php` | `extract()` / `apply()` over any block markup, keyed by path |
| Tokenised source-text keys | `token-extractor.php`, `post-field-translator.php` | Translation is stored by *source text*, so a change to layout/markup doesn't orphan it |
| Per-unit enumeration for the editors | `block-units.php` | Feeds the Simple and Advanced editors |
| String storage | `strings` + `string_translations` tables, `StringTranslator::register_string/save_translation` | Domain + context + language -> value |
| Render-time rebuild | `PostFieldTranslator::rebuild_content()` | Source + string map -> translated markup |
| Menus | `menu-translator.php` | Classic menus only (`wp_nav_menu_objects`) |
| Elementor | `elementor-translator.php` | Per-post widget settings |

Gap: all of it is keyed on a **post ID / translation group** and only for **public** post types.
Template parts from the theme's files have no post ID at all.

## Design

### 1. Translation scope = a "layout item"
A layout item is one of:
- `template_part` — id `theme//header` (works for theme-file parts and ones customised in the Site Editor)
- `pattern` — a synced pattern, `wp_block` post
- `navigation` — a `wp_navigation` post
- `template` — page template, `theme//single` (phase 3, optional)

Storage: reuse `strings` / `string_translations`. New domain `gtrans:layout`, context = the item id
(for example `template_part:twentytwentyfive//footer`). No new table needed. Because the key is
source text, one translated footer serves every page.

### 2. Render path
Translate the block markup **before** it is parsed and rendered, using `BlockParser::extract` +
`apply` (the same logic as `rebuild_content`). This keeps tokens, attributes (button labels, image alt)
and per-language image swaps working, and avoids string-replacing finished HTML.

Candidate hooks (a short spike in step 1 picks the final ones):
- Template parts: filter `get_block_template` / `get_block_templates` result content, or `render_block_data` for `core/template-part`.
- Synced patterns (`core/block`): `pre_render_block`, load the `ref` post, run `rebuild`, `do_blocks`.
- Navigation (`core/navigation`): same as patterns for the `ref` post; labels are `core/navigation-link` attributes (confirm `label` is in `BlockParser::attr_fields`).
- Page templates: content applied once per request on the resolved template (phase 3).

Rules: skip for the default language and `EditorContext::is_render_target()`; memoise per
request; fall back to the source text when a string has no translation.

### 3. Admin
- REST: new `layout-translations` controller (list items, get units, save unit), shaped like
  `post-translations.php` so the React editors can reuse it. Enumerate items with
  `get_block_templates( [], 'wp_template_part' )` plus `wp_block` and `wp_navigation` posts.
  Respect the existing capability checks (`CAP_TRANSLATE`).
- UI: add a "Layout" tab (Header/Footer, Patterns, Navigation) beside Posts in `dev_gemtranslate`.
  The list calls `usePostTypes`-style hooks; the editor reuses the Simple and Advanced editors by
  passing units from `BlockUnits`-style enumeration for a layout item.
- Status per item per language (untranslated / partial / done) from the string tables.

### 4. Cache and sync
- On save of a layout string, flush the page cache via the existing `cache/invalidator.php`
  (a footer change affects every page, so purge site-wide).
- When the source template part changes, new/changed strings show as untranslated; old ones remain
  (same behaviour as posts).

### 5. Elementor Theme Builder (separate, smaller step)
Elementor headers and footers are `elementor_library` posts rendered by Elementor, not by the block
filters above. Reuse `ElementorTranslator` on those posts and hook the Elementor document render
(spike needed). Ship after the block work.

## Phases
1. **Spike (0.5 day):** confirm the hooks on current WP for template parts, `core/block`, `core/navigation`; confirm nested cases (pattern inside template part).
2. **Render path + storage (1-2 days):** the `LayoutTranslator` class, memoisation, tests with a block theme (Twenty Twenty-Five).
3. **REST + editor UI (2-3 days):** controller, Layout tab, reuse of the editors, status badges.
4. **Cache purge, AI bulk translate hookup, WP-CLI (`gemtranslate layout translate`), docs (1 day).**
5. **Optional:** page templates (`wp_template`), then Elementor Theme Builder.

## Risks and open questions
- Hook behaviour differs across WP 6.x versions; the spike sets the minimum supported WP version.
- Unsynced patterns are copied into the post when inserted, so they are already covered by post translation. Only synced patterns need this feature.
- Dynamic blocks (query loop, site title, tagline): their text comes from options, not block markup. Site title and tagline would need separate option-level handling; decide whether to include.
- Free vs Pro: Polylang puts block-theme support in its paid tier. Decide what goes in `gemtranslate` vs `gemtranslate-pro`.
- Classic themes: header/footer text there goes through gettext, already covered.

## Done when
A block theme's footer text translated in the Layout tab shows in the translated language on the
front end for all pages, survives a theme update and a Site Editor edit, and the page cache is purged on save.

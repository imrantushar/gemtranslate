# REST API reference

All endpoints live under **`/wp-json/ztrans/v1/`**.

## Authentication

WordPress REST nonce header: `X-WP-Nonce: <nonce>`. The React admin reads this from `window.ztrans.nonce`. For external clients, use Application Passwords or any standard WP REST auth method.

## Response envelope

Every success response is:

```json
{
  "data": <payload>,
  "meta": { "...": "..." },
  "errors": []
}
```

Errors return a `WP_Error` with code, message, and HTTP status.

## Capabilities

| Permission | Granted to | Used on |
|---|---|---|
| `manage_options` | Administrators | Languages CRUD, AI provider config, settings, migration, packs, translators. |
| `ztrans_translate_content` | Administrators, Editors, Translators | Post / term / menu / string / SEO / job / IO endpoints. Scoped by `ztrans_assigned_languages` user meta. |
| logged-in | Any user | `/me/language`. |

---

## Languages

| Method | Path | Cap | Description |
|---|---|---|---|
| GET | `/languages` | `manage_options` | List languages. `?active=true` returns only active. |
| POST | `/languages` | `manage_options` | Add a language. Body: `code`, `locale`, `name`, `native_name?`, `flag?`, `is_rtl?`, `active?`, `position?`. |
| GET | `/languages/{code}` | `manage_options` | Show one. |
| PATCH | `/languages/{code}` | `manage_options` | Update (any field except `code`). |
| DELETE | `/languages/{code}` | `manage_options` | Delete. The default language cannot be deleted. |
| POST | `/languages/{code}/default` | `manage_options` | Set as default. |

## Posts

| Method | Path | Cap | Description |
|---|---|---|---|
| GET | `/post-types` | `ztrans_translate_content` | Public, editable post types for the current user. |
| GET | `/posts` | `ztrans_translate_content` | Paginated list with per-language status. Args: `page`, `per_page`, `search`, `post_type`, `status`. |
| GET | `/posts/{id}/translations` | `ztrans_translate_content` | Full translation set + source post (with content). |
| GET | `/posts/{id}/translations/{lang}` | `ztrans_translate_content` | Single translation row. |
| PUT | `/posts/{id}/translations/{lang}` | `ztrans_translate_content` | Save a translation. Body: `title`, `content`, `excerpt`, `slug?`, `status?`. |
| DELETE | `/posts/{id}/translations/{lang}` | `ztrans_translate_content` | Delete a translation. |
| GET | `/posts/{id}/blocks/{lang}` | `ztrans_translate_content` | Block-aware field list. Returns `is_block_content` + `fields[]`. |
| PUT | `/posts/{id}/blocks/{lang}` | `ztrans_translate_content` | Save per-block fields. Body: `fields: [{ path, value }]`. |
| GET | `/posts/{id}/meta-translations/{lang}` | `ztrans_translate_content` | Per-post meta / ACF fields. |
| PUT | `/posts/{id}/meta-translations/{lang}` | `ztrans_translate_content` | Save meta translations. Body: `fields: [{ key, value }]`. |
| GET | `/posts/{id}/translations/{lang}/revisions` | `ztrans_translate_content` | List revisions for this translation. |
| GET | `/posts/{id}/translations/{lang}/revisions/{revision_id}` | `ztrans_translate_content` | Show a revision. |
| POST | `/posts/{id}/translations/{lang}/revisions/{revision_id}/revert` | `ztrans_translate_content` | Revert the live translation. |
| GET | `/posts/{id}/translations/{lang}/diff?a=<id>&b=<id>` | `ztrans_translate_content` | Compare two revisions. |

## Terms

| Method | Path | Cap |
|---|---|---|
| GET | `/terms?taxonomy=…&search=…&page=…` | `ztrans_translate_content` |
| GET | `/terms/{id}/translations` | `ztrans_translate_content` |
| PUT | `/terms/{id}/translations/{lang}` | `ztrans_translate_content` |
| DELETE | `/terms/{id}/translations/{lang}` | `ztrans_translate_content` |

## Menus

| Method | Path | Cap |
|---|---|---|
| GET | `/menus` | `ztrans_translate_content` |
| GET | `/menus/{id}/items` | `ztrans_translate_content` |
| PUT | `/menus/items/{item_id}/translations/{lang}` | `ztrans_translate_content` |

## Strings

| Method | Path | Cap |
|---|---|---|
| GET | `/strings?lang=…&search=…&domain=…&page=…&per_page=…` | `ztrans_translate_content` |
| GET | `/strings/domains` | `ztrans_translate_content` |
| PUT | `/strings/{id}/translations/{lang}` | `ztrans_translate_content` |
| PATCH | `/strings/bulk` | `ztrans_translate_content` |
| POST | `/strings/scan` | `ztrans_translate_content` |

## SEO

| Method | Path | Cap |
|---|---|---|
| GET | `/seo/posts/{post_id}/{lang}` | `ztrans_translate_content` |
| PUT | `/seo/posts/{post_id}/{lang}` | `ztrans_translate_content` |

## AI

| Method | Path | Cap |
|---|---|---|
| GET | `/ai/providers` | `manage_options` |
| PUT | `/ai/providers` | `manage_options` |
| POST | `/ai/providers/{name}/test` | `manage_options` |
| POST | `/ai/translate` | `manage_options` |
| GET | `/ai/glossary` | `manage_options` |
| POST | `/ai/glossary` | `manage_options` |
| DELETE | `/ai/glossary/{id}` | `manage_options` |
| GET | `/ai/memory/stats` | `manage_options` |

## Jobs

| Method | Path | Cap |
|---|---|---|
| GET | `/jobs?status=…&page=…&per_page=…` | `ztrans_translate_content` |
| GET | `/jobs/counts` | `ztrans_translate_content` |
| POST | `/jobs` | `ztrans_translate_content` |
| POST | `/jobs/bulk-translate` | `ztrans_translate_content` |
| GET | `/jobs/{id}` | `ztrans_translate_content` |
| POST | `/jobs/{id}/retry` | `ztrans_translate_content` |
| DELETE | `/jobs/{id}` | `ztrans_translate_content` |

## Plugin translation packs

| Method | Path | Cap |
|---|---|---|
| GET | `/i18n/packs` | `manage_options` |
| POST | `/i18n/packs` | `manage_options` |
| DELETE | `/i18n/packs/{locale}` | `manage_options` |

## Translators

| Method | Path | Cap |
|---|---|---|
| GET | `/translators` | `manage_options` |
| GET | `/translators/{id}/languages` | `manage_options` |
| PUT | `/translators/{id}/languages` | `manage_options` |

## Migration

| Method | Path | Cap |
|---|---|---|
| GET | `/migration/detect` | `manage_options` |
| POST | `/migration/import` | `manage_options` |

## Import / Export (XLIFF / CSV)

| Method | Path | Cap |
|---|---|---|
| GET | `/io/export/strings?lang=…&format=xliff\|csv` | `ztrans_translate_content` |
| GET | `/io/export/posts?lang=…&format=xliff\|csv&post_type=…` | `ztrans_translate_content` |
| POST | `/io/import/strings` (body: `lang`, `format`, `body`) | `ztrans_translate_content` |
| POST | `/io/import/posts` (body: `lang`, `format`, `body`) | `ztrans_translate_content` |

## Current user

| Method | Path | Cap |
|---|---|---|
| GET | `/me/language` | logged-in |
| PUT | `/me/language` | logged-in |

## Settings + Stats

| Method | Path | Cap |
|---|---|---|
| GET | `/settings` | `manage_options` |
| PUT | `/settings` | `manage_options` |
| GET | `/stats` | `ztrans_translate_content` |

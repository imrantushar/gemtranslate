# WP-CLI reference

All commands live under `wp ztrans`. Run any command with `--help` for inline docs.

```bash
wp ztrans --help                # top-level help
wp ztrans <command> --help      # subcommand help
```

---

## `wp ztrans languages`

Manage languages.

```bash
wp ztrans languages list
wp ztrans languages add <code> [--locale=<locale>] [--name=<name>] [--native=<native>] [--rtl]
wp ztrans languages remove <code>
wp ztrans languages default <code>
```

**Examples:**

```bash
wp ztrans languages add es --locale=es_ES --name=Spanish --native=Español
wp ztrans languages add ar --locale=ar --name=Arabic --native=العربية --rtl
wp ztrans languages default es
wp ztrans languages remove fr
```

`languages list` formatted as a table:

```
+-------+--------+----------+---------+--------+
| code  | locale | name     | default | active |
+-------+--------+----------+---------+--------+
| en    | en_US  | English  | yes     | yes    |
| es    | es_ES  | Spanish  |         | yes    |
+-------+--------+----------+---------+--------+
```

---

## `wp ztrans pack`

Manage the plugin's own translation packs (PO / MO / JSON in `languages/`).

```bash
wp ztrans pack list
wp ztrans pack generate <locale> [--target-lang=<code>]
wp ztrans pack delete <locale>
```

**Examples:**

```bash
# Auto-translate the Zentranslate admin into Spanish using your AI provider.
wp ztrans pack generate es_ES
wp ztrans pack generate pt_BR --target-lang=pt-br
wp ztrans pack list
wp ztrans pack delete fr_FR
```

`--target-lang` overrides the language code passed to the AI translator
(defaults to the part before `_` in the locale).

---

## `wp ztrans translate-all`

Queue async AI translation jobs for every published post in a language.

```bash
wp ztrans translate-all <lang> [--post-type=<type>] [--limit=<n>] [--overwrite]
```

**Examples:**

```bash
# Translate every post into Spanish (skip ones already translated).
wp ztrans translate-all es

# Translate only the 50 most recent products, re-translating existing ones.
wp ztrans translate-all es --post-type=product --limit=50 --overwrite
```

Output:

```
Queueing post → es  100% [============================] 0:01 / 0:01
Success: 200 jobs queued. Use 'wp ztrans jobs status' to monitor.
```

---

## `wp ztrans jobs`

```bash
wp ztrans jobs status     # counts of pending / running / success / failed
wp ztrans jobs clear      # remove finished jobs from the table
```

---

## `wp ztrans memory`

Translation Memory stats:

```bash
wp ztrans memory
```

Output:

```
+---------+------+
| entries | hits |
+---------+------+
| 1240    | 583  |
+---------+------+
```

---

## `wp ztrans strings`

```bash
wp ztrans strings scan active_theme
wp ztrans strings scan all_plugins
wp ztrans strings scan /abs/path/to/dir
```

Walks the target directory, extracts every `__()` / `_e()` / `_x()` call,
registers strings in the database for translation.

---

## `wp ztrans migrate`

Import translations from another multilingual plugin.

```bash
wp ztrans migrate wpml
wp ztrans migrate polylang
wp ztrans migrate translatepress
```

Output (example):

```
+----------+-----------+-------+-------+---------+---------+
| source   | languages | posts | terms | strings | skipped |
+----------+-----------+-------+-------+---------+---------+
| wpml     | 3         | 142   | 0     | 0       | 5       |
+----------+-----------+-------+-------+---------+---------+
Success: Import complete.
```

---

## Composing with other CLI tools

```bash
# Translate every post into 3 languages, monitor until done.
for lang in es fr de; do
  wp ztrans translate-all "$lang"
done
while [ "$(wp ztrans jobs status --format=json | jq '.[0].pending + .[0].running')" -gt 0 ]; do
  sleep 5
done
echo "All jobs complete."
```

```bash
# Build the plugin's own admin in five languages in one go.
for locale in es_ES fr_FR de_DE it_IT pt_BR; do
  wp ztrans pack generate "$locale"
done
```

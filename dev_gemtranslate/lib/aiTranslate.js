import { __, sprintf } from '@wordpress/i18n';

/** RFC-4180 field quoting. */
function csvField(value) {
	const s = String(value ?? '');
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows from the strings API -> CSV text the AI model translates. */
export function buildCsv(rows) {
	const lines = [['id', 'source', 'context', 'target'].join(',')];
	rows.forEach((r) => {
		lines.push([r.string_id, r.source, r.context || '', ''].map(csvField).join(','));
	});
	return lines.join('\n');
}

/**
 * The instructions a user pastes into an external model together with the CSV.
 * Each rule exists because models routinely break that thing otherwise.
 */
export function buildPrompt({ sourceName, targetName, targetCode, pluginName }) {
	return [
		sprintf(
			/* translators: 1: plugin name, 2: source language, 3: target language, 4: language code. */
			__(
				'You are a professional software translator. Translate the user-interface strings of the WordPress plugin "%1$s" from %2$s into %3$s (%4$s).',
				'gemtranslate'
			),
			pluginName,
			sourceName,
			targetName,
			targetCode
		),
		'',
		__('The CSV below has the columns: id, source, context, target.', 'gemtranslate'),
		__('Fill in the "target" column with the translation of "source".', 'gemtranslate'),
		'',
		__('Rules:', 'gemtranslate'),
		__('1. Reply with ONLY the completed CSV, starting with the header line "id,source,context,target". No explanation, no markdown code fence.', 'gemtranslate'),
		__('2. Return exactly one row for every input row, in the same order. Never add, remove, merge or reorder rows.', 'gemtranslate'),
		__('3. Do not change the "id", "source" or "context" columns.', 'gemtranslate'),
		__('4. Keep placeholders exactly as they are: %s, %d, %1$s, %2$d, {name}, {{name}}, [shortcode]. You may move them to where the target language needs them.', 'gemtranslate'),
		__('5. Keep HTML tags exactly as they are and translate only the text between them, e.g. <a href="…">text</a>.', 'gemtranslate'),
		__('6. Do not translate brand names, product names, code, URLs or file names.', 'gemtranslate'),
		__('7. Use "context" to choose the right meaning of ambiguous words (for example "Post" as a noun or a verb).', 'gemtranslate'),
		__('8. Follow CSV quoting: wrap any field that contains a comma, quote or line break in double quotes, and double any quote inside it.', 'gemtranslate'),
		__('9. Use a natural, concise tone suitable for a software interface.', 'gemtranslate'),
		'',
		__('CSV:', 'gemtranslate'),
	].join('\n');
}

/**
 * Page/post variant of the prompt. Page text is already tokenised: inline
 * markup is hidden behind numbered `{1}` `{2}` placeholders, and rows are in
 * document order so neighbouring rows give the model context.
 */
export function buildPagePrompt({ sourceName, targetName, targetCode, pageTitle }) {
	return [
		sprintf(
			/* translators: 1: page title, 2: source language, 3: target language, 4: language code. */
			__(
				'You are a professional website translator. Translate the text of the web page "%1$s" from %2$s into %3$s (%4$s).',
				'gemtranslate'
			),
			pageTitle,
			sourceName,
			targetName,
			targetCode
		),
		'',
		__('The CSV below has the columns: id, source, context, target. Rows are in the order they appear on the page.', 'gemtranslate'),
		__('Fill in the "target" column with the translation of "source".', 'gemtranslate'),
		'',
		__('Rules:', 'gemtranslate'),
		__('1. Reply with ONLY the completed CSV, starting with the header line "id,source,context,target". No explanation, no markdown code fence.', 'gemtranslate'),
		__('2. Return exactly one row for every input row, in the same order. Never add, remove, merge or reorder rows.', 'gemtranslate'),
		__('3. Do not change the "id", "source" or "context" columns.', 'gemtranslate'),
		__('4. Numbered placeholders such as {1}, {2} stand for bold text, links and other markup. Keep every one of them exactly once, and move them to where the target language needs them. Never translate or renumber them.', 'gemtranslate'),
		__('5. Also keep %s, %d, {name}, [shortcode] and any HTML tag exactly as they are.', 'gemtranslate'),
		__('6. Do not translate brand names, product names, code, URLs or email addresses.', 'gemtranslate'),
		__('7. Use "context" (the kind of element, such as a heading or a button) to choose the right register: headings short, buttons imperative, body text natural.', 'gemtranslate'),
		__('8. Follow CSV quoting: wrap any field that contains a comma, quote or line break in double quotes, and double any quote inside it.', 'gemtranslate'),
		__('9. Translate for a native reader of the target language; keep the meaning and tone of the original, not the word order.', 'gemtranslate'),
		'',
		__('CSV:', 'gemtranslate'),
	].join('\n');
}

/** items: [{ id, source, context }] -> CSV text for the model. */
export function buildItemsCsv(items) {
	const lines = [['id', 'source', 'context', 'target'].join(',')];
	items.forEach((it) => {
		lines.push([it.id, it.source, it.context || '', ''].map(csvField).join(','));
	});
	return lines.join('\n');
}

/** RFC-4180 parser -> array of rows (arrays of cells). */
function parseCsvRows(text) {
	const rows = [];
	let row = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					cell += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				cell += ch;
			}
		} else if (ch === '"') {
			quoted = true;
		} else if (ch === ',') {
			row.push(cell);
			cell = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else {
			cell += ch;
		}
	}
	if (cell !== '' || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

/**
 * Parse a model's reply. Tolerates a BOM, a ```csv fence and prose around the
 * table. Returns [{ id, source, target }] for rows with a numeric id.
 */
export function parseAiCsv(text) {
	const clean = String(text || '')
		.replace(/^﻿/, '')
		.replace(/^\s*```[a-z]*\s*$/gim, '');
	const start = clean.search(/^\s*"?id"?\s*,\s*"?source"?/im);
	const rows = parseCsvRows((start >= 0 ? clean.slice(start) : clean).trim());
	if (!rows.length) return [];
	const header = rows[0].map((h) => h.trim().toLowerCase());
	const idCol = header.indexOf('id');
	const srcCol = header.indexOf('source');
	let tgtCol = header.indexOf('target');
	if (idCol < 0) return [];
	if (tgtCol < 0) tgtCol = rows[0].length - 1;
	return rows
		.slice(1)
		.filter((r) => /^\d+$/.test((r[idCol] || '').trim()))
		.map((r) => ({
			id: parseInt(r[idCol].trim(), 10),
			source: srcCol >= 0 ? r[srcCol] || '' : '',
			target: (r[tgtCol] || '').trim(),
		}));
}

const TOKEN_RE = /%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[bcdeEfFgGosuxX]|%%|\{\{?[^{}\s]+\}\}?|\[\/?[a-z_][a-z0-9_-]*[^\]]*\]/gi;
const TAG_RE = /<(\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

function missing(need, have) {
	const pool = {};
	have.forEach((h) => { pool[h] = (pool[h] || 0) + 1; });
	return need.filter((n) => {
		if (pool[n]) {
			pool[n]--;
			return false;
		}
		return true;
	});
}

/** Placeholders and tags present in `source` but missing from `target`. */
export function lostTokens(source, target) {
	const tokens = (s) => String(s || '').match(TOKEN_RE) || [];
	const tags = (s) => Array.from(String(s || '').matchAll(TAG_RE), (m) => m[1].toLowerCase());
	return [
		...missing(tokens(source), tokens(target)),
		...missing(tags(source), tags(target)).map((t) => `<${t}>`),
	];
}

export function downloadText(text, filename, mime = 'text/csv') {
	const blob = new Blob([text], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export async function copyText(text) {
	if (navigator.clipboard && window.isSecureContext) {
		await navigator.clipboard.writeText(text);
		return;
	}
	// http://*.local sites are not a secure context; fall back to execCommand.
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.opacity = '0';
	document.body.appendChild(ta);
	ta.select();
	const ok = document.execCommand('copy');
	ta.remove();
	if (!ok) throw new Error('copy failed');
}

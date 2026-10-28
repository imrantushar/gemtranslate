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

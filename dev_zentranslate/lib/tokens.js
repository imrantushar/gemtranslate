/**
 * Token helpers for the Advanced editor's formatting toolbar.
 *
 * A field's `tokens` legend maps placeholder numbers to the raw inline HTML they
 * stand for, e.g. `{ "1": "<strong>", "2": "</strong>", "3": "<a href=…>", "4":
 * "</a>", "5": "<br>" }`. Instead of showing raw `{1}` `{2}` to the translator,
 * we render each token as a styled chip and expose paired open/close tokens as
 * toolbar buttons (Bold, Link, …) that wrap the current selection.
 */

import { __ } from '@wordpress/i18n';

const SELF_CLOSING = new Set(['br', 'img', 'hr', 'wbr']);

const FRIENDLY = () => ({
	strong: __('Bold', 'zentranslate'),
	b: __('Bold', 'zentranslate'),
	em: __('Italic', 'zentranslate'),
	i: __('Italic', 'zentranslate'),
	u: __('Underline', 'zentranslate'),
	s: __('Strikethrough', 'zentranslate'),
	code: __('Code', 'zentranslate'),
	mark: __('Highlight', 'zentranslate'),
	sup: __('Superscript', 'zentranslate'),
	sub: __('Subscript', 'zentranslate'),
	small: __('Small', 'zentranslate'),
	a: __('Link', 'zentranslate'),
	br: __('Line break', 'zentranslate'),
	span: __('Span', 'zentranslate'),
	img: __('Image', 'zentranslate'),
	cite: __('Citation', 'zentranslate'),
	kbd: __('Keyboard', 'zentranslate'),
	q: __('Quote', 'zentranslate'),
});

/** Short glyph shown on the chip / toolbar button. */
const GLYPH = {
	strong: 'B',
	b: 'B',
	em: 'I',
	i: 'I',
	u: 'U',
	s: 'S̶',
	code: '</>',
	mark: 'H',
	sup: 'x²',
	sub: 'x₂',
	small: 'ᴀ',
	a: '🔗',
	br: '↵',
	span: '❝',
	img: '🖼',
	cite: '“',
	kbd: '⌨',
	q: '“',
};

/**
 * Parse one token's raw HTML into a descriptor.
 * @returns {{n:number, raw:string, tag:string, role:'open'|'close'|'self', label:string, glyph:string}}
 */
export function describeToken(n, raw) {
	const html = String(raw ?? '');
	const m = html.match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)\s*>$/);
	if (!m) {
		return {
			n: Number(n),
			raw: html,
			tag: '',
			role: 'self',
			label: html,
			glyph: '•',
		};
	}
	const isClose = m[1] === '/';
	const tag = m[2].toLowerCase();
	const selfClosed = m[4] === '/' || SELF_CLOSING.has(tag);
	const role = isClose ? 'close' : selfClosed ? 'self' : 'open';
	const label = FRIENDLY()[tag] || tag;
	return {
		n: Number(n),
		raw: html,
		tag,
		role,
		label,
		glyph: GLYPH[tag] || tag.slice(0, 3),
	};
}

/**
 * Build the toolbar action list from a tokens legend.
 * Open/close tokens of the same tag are paired via a stack; self-closing and
 * unmatched tokens become single-insert actions.
 * @param {Record<string,string>} tokens
 * @returns {Array<{type:'pair'|'single', open:number, close?:number, label:string, glyph:string}>}
 */
export function buildToolbar(tokens) {
	const entries = Object.entries(tokens || {})
		.map(([k, v]) => describeToken(k, v))
		.sort((a, b) => a.n - b.n);

	const actions = [];
	const openStack = {}; // tag -> array of pending open descriptors

	for (const tok of entries) {
		if (tok.role === 'open') {
			(openStack[tok.tag] ||= []).push(tok);
		} else if (tok.role === 'close') {
			const pending = openStack[tok.tag] && openStack[tok.tag].pop();
			if (pending) {
				actions.push({
					type: 'pair',
					open: pending.n,
					close: tok.n,
					label: pending.label,
					glyph: pending.glyph,
				});
			} else {
				// Orphan close — expose as a single so it isn't lost.
				actions.push({
					type: 'single',
					open: tok.n,
					label: `/${tok.label}`,
					glyph: tok.glyph,
				});
			}
		} else {
			actions.push({
				type: 'single',
				open: tok.n,
				label: tok.label,
				glyph: tok.glyph,
			});
		}
	}

	// Any opens left without a close (rare) — expose them too.
	Object.values(openStack).forEach((arr) =>
		(arr || []).forEach((tok) =>
			actions.push({
				type: 'single',
				open: tok.n,
				label: tok.label,
				glyph: tok.glyph,
			})
		)
	);

	// Preserve first-appearance order by token number.
	return actions.sort((a, b) => a.open - b.open);
}

/** Count `{N}` placeholders in a string. */
export function countTokens(str) {
	const m = String(str ?? '').match(/\{\d+\}/g);
	return m ? m.length : 0;
}

/**
 * Sentence segmentation for the Advanced translation editor.
 *
 * IMPORTANT: segmentation is a PURE UI LAYER. The plugin stores one translation
 * per *field* keyed by the field's tokenised source (`Hello {1}world{2}`). We
 * split that field text into sentence segments only so the translator can work
 * one sentence at a time; on save we `joinSegments()` back into the exact same
 * whole-field string the storage/render contract expects.
 *
 * The split is loss-less: every segment carries the trailing whitespace that
 * followed it (`trail`), so `segments.map(s => s.core + s.trail).join('')`
 * reproduces the original input byte-for-byte. `{N}` tokens are opaque here —
 * the source text form already replaced real tags with `{1}` placeholders, so a
 * naive scan can never break a tag.
 */

// Abbreviations whose trailing dot must NOT end a sentence.
const ABBREVIATIONS = new Set([
	'mr',
	'mrs',
	'ms',
	'dr',
	'prof',
	'sr',
	'jr',
	'st',
	'vs',
	'etc',
	'inc',
	'ltd',
	'co',
	'corp',
	'e.g',
	'i.e',
	'no',
	'vol',
	'fig',
	'al',
	'approx',
	'dept',
	'est',
	'min',
	'max',
	'a.m',
	'p.m',
	'u.s',
	'u.k',
]);

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

/**
 * Would a sentence-ending mark at index `i` be a real boundary?
 * Rejects decimals (3.14), ellipses handled by the run, and known abbreviations.
 */
function isRealBoundary(text, i) {
	const ch = text[i];
	if (ch === '.') {
		// Decimal: digit . digit
		if (/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) {
			return false;
		}
		// Preceding word is a known abbreviation.
		let j = i - 1;
		let word = '';
		while (j >= 0 && /[A-Za-z.]/.test(text[j])) {
			word = text[j] + word;
			j--;
		}
		if (ABBREVIATIONS.has(word.replace(/\.+$/, '').toLowerCase())) {
			return false;
		}
	}
	return true;
}

/**
 * Split tokenised field text into sentence segments.
 * @param {string} text
 * @returns {Array<{core:string,trail:string}>}
 */
export function splitSentences(text) {
	const s = String(text ?? '');
	if (s.trim() === '') {
		return [{ core: s, trail: '' }];
	}

	const segments = [];
	let start = 0;
	const n = s.length;

	for (let i = 0; i < n; i++) {
		const ch = s[i];
		const isEnder = ch === '.' || ch === '!' || ch === '?';
		const isNewline = ch === '\n';

		if (!isEnder && !isNewline) {
			continue;
		}
		if (isEnder && !isRealBoundary(s, i)) {
			continue;
		}

		// Swallow a run of consecutive enders (…, ?!, ...).
		let end = i;
		if (isEnder) {
			while (end + 1 < n && (s[end + 1] === '.' || s[end + 1] === '!' || s[end + 1] === '?')) {
				end++;
			}
		}

		// A boundary only counts if whitespace / end-of-string follows. This keeps
		// "site.com" or "v2.0rc" from splitting mid-word.
		const next = s[end + 1];
		if (next !== undefined && !isSpace(next)) {
			i = end;
			continue;
		}

		// Collect trailing whitespace into `trail`.
		let t = end + 1;
		while (t < n && isSpace(s[t])) {
			t++;
		}
		segments.push({
			core: s.slice(start, end + 1),
			trail: s.slice(end + 1, t),
		});
		start = t;
		i = t - 1;
	}

	if (start < n) {
		segments.push({ core: s.slice(start), trail: '' });
	}
	return segments.length ? segments : [{ core: s, trail: '' }];
}

/**
 * Re-assemble a field value from per-segment translations.
 *
 * - Empty translation for a segment → falls back to that segment's source
 *   `core`, so a partially-translated paragraph still renders coherently.
 * - EVERY segment empty → returns '' so the field is treated as untranslated
 *   (render falls back to the source) instead of a whitespace-only string.
 *
 * @param {Array<{core:string,trail:string}>} segments
 * @param {string[]} translations Per-segment translated text (same length).
 * @returns {string}
 */
export function joinSegments(segments, translations) {
	const anyFilled = translations.some((t) => String(t ?? '').trim() !== '');
	if (!anyFilled) {
		return '';
	}
	return segments
		.map((seg, i) => {
			const t = String(translations[i] ?? '');
			return (t.trim() !== '' ? t : seg.core) + seg.trail;
		})
		.join('');
}

/**
 * Small, stable hex hash (FNV-1a 32-bit ×2 → 16 hex chars) for keying a
 * segment's confirmed state server-side. Matches the backend's
 * `^[a-f0-9]{6,64}$` validation.
 */
export function segmentHash(str) {
	const s = String(str ?? '');
	let h1 = 0x811c9dc5;
	let h2 = 0x811c9dc5 ^ 0x9e3779b9;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ (c + 0x9e), 0x01000193) >>> 0;
	}
	const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
	return hex(h1) + hex(h2);
}

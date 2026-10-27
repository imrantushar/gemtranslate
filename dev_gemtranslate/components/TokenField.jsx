import { useCallback, useEffect, useMemo, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { describeToken } from '../lib/tokens';

/**
 * Token-aware rich editor.
 *
 * The stored value is always the tokenised text string (`Hello {1}world{2}`) —
 * this component is purely a nicer *presentation* of it. `{N}` placeholders are
 * rendered as atomic, non-editable chips; typing edits the surrounding text;
 * the toolbar (built by the parent from the field's token legend) wraps the
 * current selection in an open/close token pair.
 *
 * React + contentEditable don't mix by default (re-render nukes the caret), so
 * the DOM is driven imperatively: we only re-seed innerHTML when the incoming
 * `value` differs from what we last emitted.
 */
export default function TokenField({
	value,
	tokens = {},
	onChange,
	onFocus,
	placeholder,
	singleLine = false,
	toolbarRef,
}) {
	const ref = useRef(null);
	const lastEmitted = useRef(null);

	const chipMeta = useMemo(() => {
		const map = {};
		Object.entries(tokens).forEach(([n, raw]) => {
			map[String(n)] = describeToken(n, raw);
		});
		return map;
	}, [tokens]);

	const makeChip = useCallback(
		(n) => {
			const meta = chipMeta[String(n)] || {
				glyph: String(n),
				raw: `{${n}}`,
				label: `{${n}}`,
			};
			const span = document.createElement('span');
			span.setAttribute('contenteditable', 'false');
			span.setAttribute('data-n', String(n));
			span.setAttribute('title', `${meta.label} — ${meta.raw}`);
			span.className =
				'gtrans-tok gtrans-inline-flex gtrans-items-center gtrans-align-baseline gtrans-mx-0.5 gtrans-rounded gtrans-bg-indigo-100 gtrans-px-1 gtrans-text-[11px] gtrans-font-semibold gtrans-text-indigo-700 gtrans-select-none';
			span.textContent = meta.glyph;
			return span;
		},
		[chipMeta]
	);

	/** value string -> DOM nodes inside the editor. */
	const seed = useCallback(
		(str) => {
			const el = ref.current;
			if (!el) return;
			el.textContent = '';
			const parts = String(str ?? '').split(/(\{\d+\})/g);
			parts.forEach((part) => {
				if (!part) return;
				const m = part.match(/^\{(\d+)\}$/);
				if (m) {
					el.appendChild(makeChip(m[1]));
				} else {
					el.appendChild(document.createTextNode(part));
				}
			});
		},
		[makeChip]
	);

	/** editor DOM -> value string. */
	const serialize = useCallback(() => {
		const el = ref.current;
		if (!el) return '';
		let out = '';
		const walk = (node) => {
			node.childNodes.forEach((child) => {
				if (child.nodeType === Node.TEXT_NODE) {
					out += child.nodeValue;
				} else if (child.nodeType === Node.ELEMENT_NODE) {
					const n = child.getAttribute && child.getAttribute('data-n');
					if (n) {
						out += `{${n}}`;
					} else if (child.tagName === 'BR') {
						out += '\n';
					} else {
						// Block wrappers the browser injected on Enter/paste.
						if (/^(DIV|P)$/.test(child.tagName) && out && !out.endsWith('\n')) {
							out += '\n';
						}
						walk(child);
					}
				}
			});
		};
		walk(el);
		return out;
	}, []);

	const emit = useCallback(() => {
		const next = serialize();
		lastEmitted.current = next;
		onChange && onChange(next);
	}, [onChange, serialize]);

	// Seed / re-seed only on genuine external changes.
	useEffect(() => {
		if (value === lastEmitted.current) return;
		lastEmitted.current = value;
		seed(value);
	}, [value, seed]);

	const insertAtCaret = useCallback(
		(action) => {
			const el = ref.current;
			if (!el) return;
			el.focus();
			const sel = window.getSelection();
			let range;
			if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
				range = sel.getRangeAt(0);
			} else {
				range = document.createRange();
				range.selectNodeContents(el);
				range.collapse(false);
			}

			if (action.type === 'single') {
				const chip = makeChip(action.open);
				range.deleteContents();
				range.insertNode(chip);
				range.setStartAfter(chip);
			} else {
				const open = makeChip(action.open);
				const close = makeChip(action.close);
				const collapsed = range.collapsed;
				const frag = range.extractContents();
				const wrapper = document.createDocumentFragment();
				wrapper.appendChild(open);
				wrapper.appendChild(frag);
				wrapper.appendChild(close);
				range.insertNode(wrapper);
				// Caret between the chips when nothing was selected, else after close.
				range.setStartBefore(collapsed ? close : close.nextSibling || close);
				if (collapsed) range.setStartAfter(open);
			}
			range.collapse(true);
			if (sel) {
				sel.removeAllRanges();
				sel.addRange(range);
			}
			emit();
		},
		[emit, makeChip]
	);

	// Expose the insert handler to the parent-rendered toolbar.
	useEffect(() => {
		if (toolbarRef) toolbarRef.current = insertAtCaret;
	}, [toolbarRef, insertAtCaret]);

	const onKeyDown = (e) => {
		if (e.key === 'Enter') {
			if (singleLine) {
				e.preventDefault();
				return;
			}
			// Insert a plain newline instead of browser <div>/<br> soup.
			e.preventDefault();
			const sel = window.getSelection();
			if (!sel || !sel.rangeCount) return;
			const range = sel.getRangeAt(0);
			range.deleteContents();
			const nl = document.createTextNode('\n');
			range.insertNode(nl);
			range.setStartAfter(nl);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
			emit();
		}
	};

	const onPaste = (e) => {
		e.preventDefault();
		const text = (e.clipboardData || window.clipboardData).getData('text/plain');
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) return;
		const range = sel.getRangeAt(0);
		range.deleteContents();
		const node = document.createTextNode(text);
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		emit();
	};

	return (
		<div
			ref={ref}
			role="textbox"
			aria-multiline={!singleLine}
			contentEditable
			suppressContentEditableWarning
			spellCheck
			data-placeholder={placeholder || __('Type the translation…', 'gemtranslate')}
			onInput={emit}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
			onFocus={onFocus}
			className={`gtrans-tokenfield gtrans-w-full gtrans-rounded-md gtrans-border gtrans-border-gtrans-border gtrans-bg-white gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-leading-relaxed gtrans-text-gray-900 focus:gtrans-border-gtrans-primary focus:gtrans-outline-none ${
				singleLine
					? 'gtrans-whitespace-nowrap gtrans-overflow-x-auto'
					: 'gtrans-min-h-[2.5rem] gtrans-whitespace-pre-wrap'
			}`}
		/>
	);
}

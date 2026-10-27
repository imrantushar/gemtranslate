import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { LoadingBlock } from '../../components/Spinner';
import TokenField from '../../components/TokenField';
import {
	usePostFields,
	useSavePostFields,
	useConfirmedSegments,
	useSaveConfirmedSegments,
} from '../../hooks/usePostFields';
import { useTranslateWithAI, useSuggestFromMemory, useGlossary } from '../../hooks/useAI';
import { splitSentences, joinSegments, segmentHash } from '../../lib/segment';
import { buildToolbar, describeToken, countTokens } from '../../lib/tokens';
import { formatErrorMessage } from '../../lib/format';
import { hasFeature } from '../../hooks/useFeatures';

// Pro enhancements inside the (free) Advanced editor.
const HAS_TM = hasFeature('translation_memory');
const HAS_GLOSSARY = hasFeature('glossary');
const HAS_BULK = hasFeature('ai_bulk');

/**
 * WPML-style Advanced translation editor. Sentence-segmented, side-by-side,
 * with a formatting toolbar (no raw {N} tokens), inline translation-memory
 * suggestions, glossary highlighting, and per-segment completion + progress.
 *
 * Segmentation is presentational only — on save each field's segments are
 * re-joined into the one tokenised whole-field string the storage/render
 * contract expects (see lib/segment.js).
 */
export default function AdvancedEditor({ postId, sourceLang, targetLang, country = '' }) {
	const data = usePostFields(postId, targetLang, country);
	const glossary = useGlossary();
	const confirmedQ = useConfirmedSegments(postId, targetLang, country);
	const save = useSavePostFields();
	const saveConfirmed = useSaveConfirmedSegments();
	const ai = useTranslateWithAI();
	const suggest = useSuggestFromMemory();

	const [drafts, setDrafts] = useState({}); // { path: [segTranslation, …] }
	const [suggestions, setSuggestions] = useState({}); // { segKey: [ {target, score, …} ] }
	const [toast, setToast] = useState(null);

	// Editable fields with a non-empty source, each split into source segments.
	const fields = useMemo(() => {
		const raw = data.data?.fields || [];
		return raw
			.filter((f) => String(f.source || '').trim() !== '')
			.map((f) => {
				const segs = splitSentences(f.source);
				let collapsed = false;
				let initial = segs.map(() => '');
				const existing = String(f.translation || '');
				if (existing.trim() !== '') {
					const tsegs = splitSentences(existing);
					if (tsegs.length === segs.length) {
						initial = tsegs.map((t) => t.core);
					} else {
						// Can't align a Simple-mode translation to sentences — keep the
						// whole field as a single safe segment so nothing is lost.
						collapsed = true;
						return {
							...f,
							segs: [{ core: f.source, trail: '' }],
							initial: [existing],
							collapsed,
						};
					}
				}
				return { ...f, segs, initial, collapsed };
			});
	}, [data.data]);

	// Seed drafts whenever the field set changes (post/lang/country switch).
	useEffect(() => {
		const next = {};
		fields.forEach((f) => {
			next[f.path] = f.initial.slice();
		});
		setDrafts(next);
		setSuggestions({});
	}, [fields]);

	const glossaryPairs = useMemo(() => {
		if (!HAS_GLOSSARY) return [];
		const s = (sourceLang || '').toLowerCase();
		const t = (targetLang || '').toLowerCase();
		return (glossary.data || [])
			.filter(
				(g) =>
					(g.source_lang || '').toLowerCase() === s && (g.target_lang || '').toLowerCase() === t
			)
			.map((g) => ({
				term: String(g.source_term || ''),
				target: String(g.target_term || ''),
				caseSensitive: Number(g.case_sensitive) === 1,
				dnt: Number(g.do_not_translate) === 1,
			}))
			.filter((g) => g.term !== '')
			.sort((a, b) => b.term.length - a.term.length);
	}, [glossary.data, sourceLang, targetLang]);

	const confirmedSet = useMemo(() => new Set(confirmedQ.data?.confirmed || []), [confirmedQ.data]);

	// ---- Progress ----
	const { totalSegs, translatedSegs, confirmedSegs } = useMemo(() => {
		let total = 0;
		let translated = 0;
		let confirmed = 0;
		fields.forEach((f) => {
			f.segs.forEach((seg, i) => {
				total++;
				const val = (drafts[f.path]?.[i] ?? '').trim();
				if (val !== '') translated++;
				if (confirmedSet.has(segKey(f.path, i, seg.core))) confirmed++;
			});
		});
		return {
			totalSegs: total,
			translatedSegs: translated,
			confirmedSegs: confirmed,
		};
	}, [fields, drafts, confirmedSet]);

	if (data.isLoading) return <LoadingBlock>{__('Loading editor…', 'gemtranslate')}</LoadingBlock>;
	if (!data.data) return null;
	if (fields.length === 0) {
		return (
			<Card>
				<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
					{__('This post has no translatable text.', 'gemtranslate')}
				</p>
			</Card>
		);
	}

	const setSeg = (path, idx, val) =>
		setDrafts((d) => {
			const arr = (d[path] || []).slice();
			arr[idx] = val;
			return { ...d, [path]: arr };
		});

	const persistConfirmed = (nextSet) => {
		saveConfirmed.mutate({
			postId,
			lang: targetLang,
			country,
			confirmed: Array.from(nextSet),
		});
	};

	const toggleConfirm = (path, idx, core) => {
		const key = segKey(path, idx, core);
		const next = new Set(confirmedSet);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		persistConfirmed(next);
	};

	const saveAll = async () => {
		const payload = fields.map((f) => ({
			path: f.path,
			source: f.source,
			value: joinSegments(f.segs, drafts[f.path] || []),
		}));
		try {
			await save.mutateAsync({
				postId,
				lang: targetLang,
				country,
				fields: payload,
			});
			setToast({
				tone: 'success',
				message: __('Translations saved.', 'gemtranslate'),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const translateSegment = async (path, idx, source) => {
		try {
			const res = await ai.mutateAsync({
				text: source,
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: false,
				use_memory: true,
			});
			setSeg(path, idx, res.translations || '');
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const translateAll = async () => {
		// One batched call over every untranslated segment.
		const jobs = [];
		fields.forEach((f) => {
			f.segs.forEach((seg, i) => {
				if ((drafts[f.path]?.[i] ?? '').trim() === '')
					jobs.push({ path: f.path, idx: i, source: seg.core });
			});
		});
		if (jobs.length === 0) return;
		try {
			const res = await ai.mutateAsync({
				text: jobs.map((j) => j.source),
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: false,
				use_memory: true,
			});
			const list = res.translations || [];
			setDrafts((d) => {
				const next = { ...d };
				jobs.forEach((j, k) => {
					const arr = (next[j.path] || []).slice();
					arr[j.idx] = list[k] || arr[j.idx] || '';
					next[j.path] = arr;
				});
				return next;
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const fetchSuggestions = async (key, source) => {
		if (!HAS_TM) return; // Translation Memory is Pro.
		if (suggestions[key]) return; // already loaded
		try {
			const res = await suggest.mutateAsync({
				text: source,
				source_lang: sourceLang,
				target_lang: targetLang,
				limit: 5,
			});
			setSuggestions((s) => ({
				...s,
				[key]: res.suggestions || [],
			}));
		} catch (err) {
			setSuggestions((s) => ({ ...s, [key]: [] }));
		}
	};

	const pct = totalSegs ? Math.round((confirmedSegs / totalSegs) * 100) : 0;

	return (
		<>
			{/* ---- Sticky progress + actions ---- */}
			<div className="gtrans-sticky gtrans-top-0 gtrans-z-10 gtrans-mb-4 gtrans-rounded-lg gtrans-border gtrans-border-line gtrans-bg-surface gtrans-p-4 gtrans-shadow-sm">
				<div className="gtrans-mb-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3">
					<div className="gtrans-text-sm gtrans-font-medium gtrans-text-ink">
						{sprintf(
							/* translators: 1: confirmed count, 2: total, 3: percent. */
							__('%1$d of %2$d segments complete (%3$d%%)', 'gemtranslate'),
							confirmedSegs,
							totalSegs,
							pct
						)}
						<span className="gtrans-ml-2 gtrans-text-xs gtrans-font-normal gtrans-text-muted">
							{sprintf(
								/* translators: %d: translated segment count. */
								__('· %d translated', 'gemtranslate'),
								translatedSegs
							)}
						</span>
					</div>
					<div className="gtrans-flex gtrans-gap-2">
						{HAS_BULK && (
							<Button variant="secondary" size="sm" onClick={translateAll} loading={ai.isPending}>
								{__('Translate all with AI', 'gemtranslate')}
							</Button>
						)}
						<Button size="sm" onClick={saveAll} loading={save.isPending}>
							{__('Save translations', 'gemtranslate')}
						</Button>
					</div>
				</div>
				<div className="gtrans-h-2 gtrans-w-full gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-body">
					<div
						className="gtrans-h-full gtrans-rounded-full gtrans-bg-green-500 gtrans-transition-all"
						style={{ width: `${pct}%` }}
					/>
				</div>
			</div>

			{glossaryPairs.length > 0 && (
				<p className="gtrans-mb-3 gtrans-text-xs gtrans-text-muted">
					<span className="gtrans-gloss gtrans-mr-1">{__('highlighted', 'gemtranslate')}</span>
					{__('words are glossary terms — hover to see the preferred translation.', 'gemtranslate')}
				</p>
			)}

			<div className="gtrans-flex gtrans-flex-col gtrans-gap-5">
				{fields.map((f) => (
					<FieldGroup
						key={f.path}
						field={f}
						drafts={drafts[f.path] || []}
						glossaryPairs={glossaryPairs}
						confirmedSet={confirmedSet}
						suggestions={suggestions}
						onChangeSeg={setSeg}
						onToggleConfirm={toggleConfirm}
						onAISeg={translateSegment}
						aiBusy={ai.isPending}
						onFetchSuggestions={fetchSuggestions}
					/>
				))}
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

/** Segment key mirrors the backend hash validation (hex). */
function segKey(path, idx, core) {
	return segmentHash(`${path}#${idx}#${core}`);
}

function labelFor(f) {
	if (f.path === 'title') return __('Title', 'gemtranslate');
	if (f.path === 'excerpt') return __('Excerpt', 'gemtranslate');
	if (f.path === 'body') return __('Body', 'gemtranslate');
	return f.block + (f.kind === 'attr' ? ` · ${f.attr}` : '');
}

function FieldGroup({
	field,
	drafts,
	glossaryPairs,
	confirmedSet,
	suggestions,
	onChangeSeg,
	onToggleConfirm,
	onAISeg,
	aiBusy,
	onFetchSuggestions,
}) {
	const toolbar = useMemo(() => buildToolbar(field.tokens || {}), [field.tokens]);
	return (
		<div className="gtrans-rounded-lg gtrans-border gtrans-border-line gtrans-bg-surface">
			<div className="gtrans-border-b gtrans-border-line gtrans-px-4 gtrans-py-2 gtrans-text-xs gtrans-font-semibold gtrans-uppercase gtrans-tracking-wide gtrans-text-muted">
				{labelFor(field)}
				{field.collapsed && (
					<span className="gtrans-ml-2 gtrans-rounded gtrans-bg-body gtrans-px-1.5 gtrans-py-0.5 gtrans-normal-case gtrans-text-[10px] gtrans-text-muted">
						{__('whole field', 'gemtranslate')}
					</span>
				)}
			</div>
			<div className="gtrans-divide-y gtrans-divide-gtrans-border">
				{field.segs.map((seg, i) => (
					<SegmentRow
						key={`${field.path}-${i}`}
						fieldPath={field.path}
						index={i}
						seg={seg}
						tokens={field.tokens || {}}
						toolbar={toolbar}
						draft={drafts[i] ?? ''}
						glossaryPairs={glossaryPairs}
						confirmed={confirmedSet.has(segKey(field.path, i, seg.core))}
						suggestions={suggestions[segKey(field.path, i, seg.core)]}
						onChange={(v) => onChangeSeg(field.path, i, v)}
						onToggleConfirm={() => onToggleConfirm(field.path, i, seg.core)}
						onAI={() => onAISeg(field.path, i, seg.core)}
						aiBusy={aiBusy}
						onFocus={() => onFetchSuggestions(segKey(field.path, i, seg.core), seg.core)}
					/>
				))}
			</div>
		</div>
	);
}

function SegmentRow({
	seg,
	tokens,
	toolbar,
	draft,
	glossaryPairs,
	confirmed,
	suggestions,
	onChange,
	onToggleConfirm,
	onAI,
	aiBusy,
	onFocus,
}) {
	const insertRef = useRef(null);
	const [showSug, setShowSug] = useState(false);

	const srcTokens = countTokens(seg.core);
	const dstTokens = countTokens(draft);
	const mismatch = draft.trim() !== '' && srcTokens !== dstTokens;
	const empty = draft.trim() === '';

	return (
		<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-[1fr_1fr_auto] gtrans-gap-3 gtrans-p-4">
			{/* Source */}
			<div className="gtrans-rounded-md gtrans-bg-body gtrans-p-2.5 gtrans-text-sm gtrans-leading-relaxed gtrans-text-label">
				{renderSource(seg.core, tokens, glossaryPairs)}
			</div>

			{/* Translation */}
			<div>
				<div className="gtrans-mb-1.5 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1">
					{toolbar.map((a) => (
						<button
							key={`${a.type}-${a.open}`}
							type="button"
							title={a.label}
							onClick={() => insertRef.current && insertRef.current(a)}
							className="gtrans-bare gtrans-rounded gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[11px] gtrans-font-semibold gtrans-text-muted hover:gtrans-bg-body"
						>
							{a.glyph}
						</button>
					))}
					<span className="gtrans-mx-1 gtrans-h-4 gtrans-w-px gtrans-bg-line" />
					<button
						type="button"
						title={__('Copy source', 'gemtranslate')}
						onClick={() => onChange(seg.core)}
						className="gtrans-bare gtrans-rounded gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[11px] gtrans-text-muted hover:gtrans-bg-body"
					>
						⧉
					</button>
					<button
						type="button"
						title={__('Translate with AI', 'gemtranslate')}
						onClick={onAI}
						disabled={aiBusy}
						className="gtrans-bare gtrans-rounded gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[11px] gtrans-text-indigo-600 hover:gtrans-bg-indigo-50 disabled:gtrans-opacity-50"
					>
						{__('AI', 'gemtranslate')}
					</button>
					{suggestions !== undefined && suggestions.length > 0 && (
						<button
							type="button"
							onClick={() => setShowSug((v) => !v)}
							className="gtrans-bare gtrans-rounded gtrans-border gtrans-border-amber-200 gtrans-bg-amber-50 gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[11px] gtrans-text-amber-700"
						>
							{sprintf(
								/* translators: %d: number of translation-memory matches. */
								__('TM · %d', 'gemtranslate'),
								suggestions.length
							)}
						</button>
					)}
				</div>

				<TokenField
					value={draft}
					tokens={tokens}
					toolbarRef={insertRef}
					singleLine={false}
					onChange={onChange}
					onFocus={onFocus}
				/>

				{mismatch && (
					<div className="gtrans-mt-1 gtrans-text-[11px] gtrans-text-amber-700">
						{sprintf(
							/* translators: 1: source token count, 2: translation token count. */
							__(
								'Formatting mismatch — source has %1$d tags, translation has %2$d.',
								'gemtranslate'
							),
							srcTokens,
							dstTokens
						)}
					</div>
				)}

				{showSug && suggestions && suggestions.length > 0 && (
					<div className="gtrans-mt-1.5 gtrans-rounded-md gtrans-border gtrans-border-amber-200 gtrans-bg-amber-50 gtrans-p-2">
						<div className="gtrans-mb-1 gtrans-text-[10px] gtrans-font-semibold gtrans-uppercase gtrans-text-amber-700">
							{__('Translation memory', 'gemtranslate')}
						</div>
						<div className="gtrans-flex gtrans-flex-col gtrans-gap-1">
							{suggestions.map((s, k) => (
								<button
									key={k}
									type="button"
									onClick={() => {
										onChange(s.target);
										setShowSug(false);
									}}
									className="gtrans-bare gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-rounded gtrans-bg-surface gtrans-px-2 gtrans-py-1 gtrans-text-left gtrans-text-xs gtrans-text-label hover:gtrans-bg-amber-100"
								>
									<span
										className={`gtrans-shrink-0 gtrans-rounded gtrans-px-1 gtrans-text-[10px] gtrans-font-semibold ${
											s.exact
												? 'gtrans-bg-green-100 gtrans-text-green-700'
												: 'gtrans-bg-amber-100 gtrans-text-amber-700'
										}`}
									>
										{s.score}%
									</span>
									<span className="gtrans-truncate">{s.target}</span>
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Complete toggle */}
			<div className="gtrans-flex gtrans-items-start gtrans-justify-end lg:gtrans-pt-6">
				<label
					title={
						empty
							? __('Translate this segment first', 'gemtranslate')
							: __('Mark complete', 'gemtranslate')
					}
					className={`gtrans-inline-flex gtrans-cursor-pointer gtrans-items-center gtrans-gap-1 gtrans-rounded gtrans-px-2 gtrans-py-1 gtrans-text-xs ${
						confirmed ? 'gtrans-bg-green-50 gtrans-text-green-700' : 'gtrans-text-muted'
					} ${empty ? 'gtrans-cursor-not-allowed gtrans-opacity-50' : ''}`}
				>
					<input
						type="checkbox"
						checked={confirmed}
						disabled={empty}
						onChange={onToggleConfirm}
						className="gtrans-h-3.5 gtrans-w-3.5"
					/>
					{confirmed ? __('Done', 'gemtranslate') : __('Mark', 'gemtranslate')}
				</label>
			</div>
		</div>
	);
}

/**
 * Render tokenised source text as read-only nodes: `{N}` tokens become styled
 * chips; plain text runs get glossary terms highlighted.
 */
function renderSource(text, tokens, glossaryPairs) {
	const parts = String(text).split(/(\{\d+\})/g);
	return parts.map((part, i) => {
		if (!part) return null;
		const m = part.match(/^\{(\d+)\}$/);
		if (m) {
			const meta = describeToken(m[1], tokens[m[1]]);
			return (
				<span
					key={i}
					title={`${meta.label} — ${meta.raw}`}
					className="gtrans-tok gtrans-mx-0.5 gtrans-inline-flex gtrans-items-center gtrans-rounded gtrans-bg-indigo-100 gtrans-px-1 gtrans-text-[11px] gtrans-font-semibold gtrans-text-indigo-700"
				>
					{meta.glyph}
				</span>
			);
		}
		return <span key={i}>{highlightGlossary(part, glossaryPairs)}</span>;
	});
}

/** Wrap glossary-term occurrences in a plain text run. */
function highlightGlossary(text, pairs) {
	if (!pairs || pairs.length === 0) return text;

	// Collect non-overlapping matches (longest term wins).
	const matches = [];
	pairs.forEach((p) => {
		const flags = p.caseSensitive ? 'g' : 'gi';
		let re;
		try {
			re = new RegExp(escapeRegExp(p.term), flags);
		} catch (e) {
			return;
		}
		let mm;
		while ((mm = re.exec(text)) !== null) {
			matches.push({
				start: mm.index,
				end: mm.index + mm[0].length,
				text: mm[0],
				pair: p,
			});
			if (mm.index === re.lastIndex) re.lastIndex++;
		}
	});
	if (matches.length === 0) return text;
	matches.sort((a, b) => a.start - b.start || b.end - a.end);

	const out = [];
	let cursor = 0;
	matches.forEach((mt, i) => {
		if (mt.start < cursor) return; // overlaps an earlier match
		if (mt.start > cursor) out.push(text.slice(cursor, mt.start));
		out.push(
			<span
				key={`g${i}`}
				className={`gtrans-gloss ${mt.pair.dnt ? 'gtrans-gloss-dnt' : ''}`}
				title={
					mt.pair.dnt
						? __('Do not translate', 'gemtranslate')
						: sprintf(
								/* translators: %s: preferred translation. */ __('Preferred: %s', 'gemtranslate'),
								mt.pair.target
						  )
				}
			>
				{mt.text}
			</span>
		);
		cursor = mt.end;
	});
	if (cursor < text.length) out.push(text.slice(cursor));
	return out;
}

function escapeRegExp(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import TopbarActions from '../../components/TopbarActions';
import Toast from '../../components/Toast';
import { FormSkeleton } from '../../components/Skeleton';
import TokenField from '../../components/TokenField';
import {
	usePostFields,
	useSavePostFields,
	useConfirmedSegments,
	useSaveConfirmedSegments,
} from '../../hooks/usePostFields';
import { splitSentences, joinSegments, segmentHash } from '../../lib/segment';
import { buildToolbar, describeToken, countTokens } from '../../lib/tokens';
import { formatErrorMessage } from '../../lib/format';
import { PageAiButton } from './PageAiModal';

/**
 * WPML-style Advanced translation editor. Sentence-segmented, side-by-side,
 * with a formatting toolbar (no raw {N} tokens) and per-segment completion +
 * progress.
 *
 * Segmentation is presentational only — on save each field's segments are
 * re-joined into the one tokenised whole-field string the storage/render
 * contract expects (see lib/segment.js).
 */
export default function AdvancedEditor({ postId, pageTitle = '', slug = '', sourceLang, targetLang, country = '' }) {
	const data = usePostFields(postId, targetLang, country);
	const confirmedQ = useConfirmedSegments(postId, targetLang, country);
	const save = useSavePostFields();
	const saveConfirmed = useSaveConfirmedSegments();

	const [drafts, setDrafts] = useState({}); // { path: [segTranslation, …] }
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
	}, [fields]);

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

	if (data.isLoading) return <FormSkeleton />;
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

	// One AI row per sentence segment, in page order. Row key = "path#index".
	const aiItems = fields.flatMap((f) =>
		f.segs.map((seg, i) => ({ key: `${f.path}#${i}`, source: seg.core, context: labelFor(f) }))
	);
	const aiDrafts = {};
	fields.forEach((f) => {
		(drafts[f.path] || []).forEach((v, i) => {
			aiDrafts[`${f.path}#${i}`] = v;
		});
	});
	const applyAi = (map) =>
		setDrafts((d) => {
			const next = { ...d };
			Object.entries(map).forEach(([key, value]) => {
				const at = key.lastIndexOf('#');
				const path = key.slice(0, at);
				const arr = (next[path] || []).slice();
				arr[Number(key.slice(at + 1))] = value;
				next[path] = arr;
			});
			return next;
		});

	const pct = totalSegs ? Math.round((confirmedSegs / totalSegs) * 100) : 0;

	return (
		<>
			{/* Save lives in the global header so it stays reachable while scrolling. */}
			<TopbarActions>
				<Button onClick={saveAll} loading={save.isPending}>
					{__('Save translations', 'gemtranslate')}
				</Button>
			</TopbarActions>

			<div className="gtrans-mb-4 gtrans-flex gtrans-items-center gtrans-gap-4">
				<div className="gtrans-h-1.5 gtrans-w-48 gtrans-flex-shrink-0 gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-line">
					<div
						className="gtrans-h-full gtrans-rounded-full gtrans-bg-green-500 gtrans-transition-all"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<span className="gtrans-text-sm gtrans-text-ink">
					{sprintf(
						/* translators: 1: confirmed count, 2: total, 3: percent. */
						__('%1$d of %2$d segments complete (%3$d%%)', 'gemtranslate'),
						confirmedSegs,
						totalSegs,
						pct
					)}
				</span>
				<span className="gtrans-text-xs gtrans-text-muted">
					{sprintf(
						/* translators: %d: translated segment count. */
						__('%d translated', 'gemtranslate'),
						translatedSegs
					)}
				</span>
				<div className="gtrans-ml-auto">
					<PageAiButton
						items={aiItems}
						drafts={aiDrafts}
						pageTitle={pageTitle}
						slug={slug}
						sourceLang={sourceLang}
						targetLang={targetLang}
						onApply={applyAi}
						onNotify={setToast}
					/>
				</div>
			</div>

			<div className="gtrans-flex gtrans-flex-col gtrans-gap-5">
				{fields.map((f) => (
					<FieldGroup
						key={f.path}
						field={f}
						drafts={drafts[f.path] || []}
						confirmedSet={confirmedSet}
						onChangeSeg={setSeg}
						onToggleConfirm={toggleConfirm}
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
	confirmedSet,
	onChangeSeg,
	onToggleConfirm,
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
						seg={seg}
						tokens={field.tokens || {}}
						toolbar={toolbar}
						draft={drafts[i] ?? ''}
						confirmed={confirmedSet.has(segKey(field.path, i, seg.core))}
						onChange={(v) => onChangeSeg(field.path, i, v)}
						onToggleConfirm={() => onToggleConfirm(field.path, i, seg.core)}
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
	confirmed,
	onChange,
	onToggleConfirm,
}) {
	const insertRef = useRef(null);

	const srcTokens = countTokens(seg.core);
	const dstTokens = countTokens(draft);
	const mismatch = draft.trim() !== '' && srcTokens !== dstTokens;
	const empty = draft.trim() === '';

	return (
		<div className="gtrans-grid gtrans-grid-cols-1 gtrans-gap-x-4 gtrans-gap-y-1 gtrans-px-4 gtrans-py-3 lg:gtrans-grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
			{/* Column heads: the boxes below start on the same line. */}
			<div className="gtrans-hidden lg:gtrans-block" aria-hidden="true" />
			<div className="gtrans-flex gtrans-h-8 gtrans-items-center gtrans-text-xs gtrans-font-medium gtrans-text-muted">
				{__('Source', 'gemtranslate')}
			</div>
			<div className="gtrans-flex gtrans-h-8 gtrans-flex-wrap gtrans-items-center gtrans-gap-1">
				<span className="gtrans-mr-1 gtrans-text-xs gtrans-font-medium gtrans-text-muted">
					{__('Translation', 'gemtranslate')}
				</span>
				{toolbar.map((a) => (
					<button
						key={`${a.type}-${a.open}`}
						type="button"
						title={a.label}
						onClick={() => insertRef.current && insertRef.current(a)}
						className="gtrans-bare gtrans-cursor-pointer gtrans-rounded gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-2 gtrans-py-1 gtrans-text-xs gtrans-font-semibold gtrans-text-muted hover:gtrans-bg-body"
					>
						{a.glyph}
					</button>
				))}
			</div>

			{/* Mark complete: a checkbox in the gutter, level with the boxes. */}
			<label
				title={
					empty
						? __('Translate this segment first', 'gemtranslate')
						: confirmed
							? __('Marked complete', 'gemtranslate')
							: __('Mark complete', 'gemtranslate')
				}
				className={`gtrans-flex gtrans-items-start gtrans-gap-2 gtrans-pt-2.5 gtrans-text-xs gtrans-text-muted ${
					empty ? 'gtrans-cursor-not-allowed gtrans-opacity-50' : 'gtrans-cursor-pointer'
				}`}
			>
				<input
					type="checkbox"
					checked={confirmed}
					disabled={empty}
					onChange={onToggleConfirm}
					aria-label={__('Mark complete', 'gemtranslate')}
					className="gtrans-m-0 gtrans-h-4 gtrans-w-4 gtrans-accent-green-500"
				/>
				<span className="lg:gtrans-hidden">{__('Mark complete', 'gemtranslate')}</span>
			</label>

			{/* Source: same box metrics as the field so the text lines up. */}
			<div className="gtrans-relative gtrans-min-h-[2.5rem] gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-border-transparent gtrans-bg-body gtrans-py-2 gtrans-pl-3 gtrans-pr-11 gtrans-text-sm gtrans-leading-relaxed gtrans-text-label">
				{renderSource(seg.core, tokens)}
				<button
					type="button"
					title={__('Copy source into the translation', 'gemtranslate')}
					aria-label={__('Copy source into the translation', 'gemtranslate')}
					onClick={() => onChange(seg.core)}
					className="gtrans-bare gtrans-absolute gtrans-right-1.5 gtrans-top-1.5 gtrans-inline-flex gtrans-h-7 gtrans-w-7 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-p-0 gtrans-text-description hover:gtrans-border-primary hover:gtrans-text-primary"
				>
					<Icon name="copy" size={14} />
				</button>
			</div>

			<div>
				<TokenField
					value={draft}
					tokens={tokens}
					toolbarRef={insertRef}
					singleLine={false}
					onChange={onChange}
				/>

				{mismatch && (
					<div className="gtrans-mt-1 gtrans-text-xs gtrans-text-amber-700">
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
			</div>
		</div>
	);
}

/**
 * Render tokenised source text as read-only nodes: `{N}` tokens become styled
 * chips.
 */
function renderSource(text, tokens) {
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
					className="gtrans-tok gtrans-mx-0.5 gtrans-inline-flex gtrans-items-center gtrans-rounded gtrans-bg-indigo-100 gtrans-px-1 gtrans-text-xs gtrans-font-semibold gtrans-text-indigo-700"
				>
					{meta.glyph}
				</span>
			);
		}
		return <span key={i}>{part}</span>;
	});
}

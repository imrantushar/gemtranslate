import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
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

/**
 * WPML-style Advanced translation editor. Sentence-segmented, side-by-side,
 * with a formatting toolbar (no raw {N} tokens) and per-segment completion +
 * progress.
 *
 * Segmentation is presentational only — on save each field's segments are
 * re-joined into the one tokenised whole-field string the storage/render
 * contract expects (see lib/segment.js).
 */
export default function AdvancedEditor({ postId, targetLang, country = '' }) {
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
		<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-[1fr_1fr_auto] gtrans-gap-3 gtrans-p-4">
			{/* Source */}
			<div className="gtrans-rounded-md gtrans-bg-body gtrans-p-2.5 gtrans-text-sm gtrans-leading-relaxed gtrans-text-label">
				{renderSource(seg.core, tokens)}
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
				</div>

				<TokenField
					value={draft}
					tokens={tokens}
					toolbarRef={insertRef}
					singleLine={false}
					onChange={onChange}
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
					className="gtrans-tok gtrans-mx-0.5 gtrans-inline-flex gtrans-items-center gtrans-rounded gtrans-bg-indigo-100 gtrans-px-1 gtrans-text-[11px] gtrans-font-semibold gtrans-text-indigo-700"
				>
					{meta.glyph}
				</span>
			);
		}
		return <span key={i}>{part}</span>;
	});
}

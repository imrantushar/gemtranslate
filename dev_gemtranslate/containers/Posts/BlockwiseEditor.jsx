import { useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { TextArea } from '../../components/Input';
import { FormSkeleton } from '../../components/Skeleton';
import { usePostUnits, useSavePostUnits } from '../../hooks/usePostFields';
import { formatErrorMessage } from '../../lib/format';
import { PageAiButton } from './PageAiModal';
import { pickImage } from '../../lib/media';

const countPlaceholders = (s) => (String(s || '').match(/\{\d+\}/g) || []).length;

/**
 * Block-wise editor for Gutenberg and Elementor posts. One row per
 * translatable unit (a block's text/attribute, or an Elementor widget
 * setting): source on the left, translation on the right. Markup is hidden
 * behind `{N}` placeholders exactly like the other string editors, so only
 * text can be edited and the layout always follows the source.
 */
export default function BlockwiseEditor({ postId, pageTitle = '', slug = '', sourceLang, targetLang, country = '' }) {
	const data = usePostUnits(postId, targetLang, country);
	const save = useSavePostUnits();
	const [drafts, setDrafts] = useState({});
	const [filter, setFilter] = useState('all');
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!data.data) return;
		const init = {};
		(data.data.units || []).forEach((u) => { init[u.id] = u.translation; });
		setDrafts(init);
	}, [data.data, targetLang, country]);

	const units = data.data?.units || [];
	const done = useMemo(() => units.filter((u) => (drafts[u.id] ?? '').trim() !== '').length, [units, drafts]);
	const dirty = useMemo(() => units.some((u) => (drafts[u.id] ?? '') !== u.translation), [units, drafts]);

	if (data.isLoading) return <FormSkeleton />;
	if (!data.data) return null;

	const { builder } = data.data;
	const set = (id, value) => setDrafts((d) => ({ ...d, [id]: value }));

	const submit = async () => {
		try {
			await save.mutateAsync({
				postId,
				lang: targetLang,
				country,
				units: units.map((u) => ({ id: u.id, value: drafts[u.id] ?? '' })),
			});
			setToast({ tone: 'success', message: __('Translations saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const copyAllEmpty = () => {
		setDrafts((d) => {
			const next = { ...d };
			units.forEach((u) => { if (u.kind !== 'image' && !(next[u.id] ?? '').trim()) next[u.id] = u.source; });
			return next;
		});
	};

	const shown = units.filter((u) => {
		const filled = (drafts[u.id] ?? '').trim() !== '';
		return filter === 'all' || (filter === 'todo' ? !filled : filled);
	});

	const builderLabel = builder === 'elementor'
		? __('Elementor widgets', 'gemtranslate')
		: builder === 'gutenberg'
			? __('Gutenberg blocks', 'gemtranslate')
			: __('Classic content', 'gemtranslate');

	return (
		<>
			<Card title={sprintf(
				/* translators: %s: builder name e.g. "Gutenberg blocks". */
				__('Block-wise translation · %s', 'gemtranslate'),
				builderLabel
			)}>
				<p className="gtrans-mb-3 gtrans-mt-0 gtrans-text-xs gtrans-text-muted">
					{__('Translate each block on its own. Block structure and styling follow the source; use {1} {2} placeholders to keep bold text, links and line breaks.', 'gemtranslate')}
				</p>
				{units.length === 0 && (
					<p className="gtrans-text-sm gtrans-text-muted">{__('Nothing to translate in this post.', 'gemtranslate')}</p>
				)}

				<div className="gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
					<div className="gtrans-min-w-[160px]">
						<div className="gtrans-mb-1 gtrans-text-xs gtrans-text-label">
							{sprintf(
								/* translators: 1: translated count, 2: total count. */
								__('%1$d of %2$d translated', 'gemtranslate'),
								done,
								units.length
							)}
						</div>
						<div className="gtrans-h-1.5 gtrans-w-full gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-body">
							<div
								className="gtrans-h-full gtrans-bg-emerald-400"
								style={{ width: `${units.length ? (done / units.length) * 100 : 0}%` }}
							/>
						</div>
					</div>
					<div className="gtrans-inline-flex">
						{[
							{ k: 'all', l: __('All', 'gemtranslate') },
							{ k: 'todo', l: __('Untranslated', 'gemtranslate') },
							{ k: 'done', l: __('Translated', 'gemtranslate') },
						].map((o, i) => (
							<button
								key={o.k}
								type="button"
								onClick={() => setFilter(o.k)}
								className={clsx(
									'gtrans-bare gtrans-cursor-pointer gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-1 gtrans-text-xs',
									i === 0 && 'gtrans-rounded-l-md',
									i === 2 && 'gtrans-rounded-r-md',
									i > 0 && '-gtrans-ml-px',
									filter === o.k ? 'gtrans-bg-primary gtrans-text-white' : 'gtrans-bg-surface gtrans-text-label'
								)}
							>
								{o.l}
							</button>
						))}
					</div>
					<div className="gtrans-ml-auto gtrans-flex gtrans-items-center gtrans-gap-2">
						<PageAiButton
							items={units.filter((u) => u.kind !== 'image').map((u) => ({ key: u.id, source: u.source, context: u.label }))}
							drafts={drafts}
							pageTitle={pageTitle}
							slug={slug}
							sourceLang={sourceLang}
							targetLang={targetLang}
							onApply={(map) => setDrafts((d) => ({ ...d, ...map }))}
							onNotify={setToast}
						/>
						<Button type="button" variant="secondary" size="sm" onClick={copyAllEmpty}>
							{__('Copy source to empty', 'gemtranslate')}
						</Button>
						<Button type="button" size="sm" loading={save.isPending} disabled={!dirty} onClick={submit}>
							{__('Save all', 'gemtranslate')}
						</Button>
					</div>
				</div>

				<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
					{shown.map((u) => (
						<UnitRow
							key={u.id}
							onNotify={setToast}
							unit={u}
							draft={drafts[u.id] ?? ''}
							onChange={(v) => set(u.id, v)}
						/>
					))}
					{shown.length === 0 && units.length > 0 && (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('No blocks match this filter.', 'gemtranslate')}</p>
					)}
				</div>
			</Card>
			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

function UnitRow({ unit, draft, onChange, onNotify }) {
	if (unit.kind === 'image') {
		return <ImageRow unit={unit} draft={draft} onChange={onChange} onNotify={onNotify} />;
	}
	const filled = draft.trim() !== '';
	const mismatch = filled && countPlaceholders(draft) !== countPlaceholders(unit.source);
	const single = unit.kind === 'attr' || (unit.type.startsWith('post:') && unit.id !== 'body') || (unit.kind === 'setting' && unit.source.length < 80);
	const rows = single ? 2 : Math.min(8, Math.max(3, Math.ceil(unit.source.length / 70)));

	return (
		<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-p-3">
			<div className="gtrans-mb-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
				<code title={unit.type}>{unit.label}</code>
				{unit.count > 1 && (
					<span className="gtrans-text-muted">
						{sprintf(
							/* translators: %d: number of places the same text is used. */
							__('used %d×', 'gemtranslate'),
							unit.count
						)}
					</span>
				)}
				<span
					className={clsx(
						'gtrans-ml-auto gtrans-rounded gtrans-px-2 gtrans-py-0.5',
						filled ? 'gtrans-bg-emerald-100 gtrans-text-emerald-800' : 'gtrans-bg-body gtrans-text-muted'
					)}
				>
					{filled ? __('Translated', 'gemtranslate') : __('Untranslated', 'gemtranslate')}
				</span>
			</div>
			<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-3">
				<TextArea rows={rows} value={unit.source} readOnly className="gtrans-bg-body" aria-label={__('Source', 'gemtranslate')} />
				<div className="gtrans-flex gtrans-gap-2">
					<TextArea
						rows={rows}
						value={draft}
						onChange={(e) => onChange(e.target.value)}
						placeholder={__('Translation', 'gemtranslate')}
						aria-label={__('Translation', 'gemtranslate')}
					/>
					<button
						type="button"
						title={__('Copy source', 'gemtranslate')}
						aria-label={__('Copy source', 'gemtranslate')}
						onClick={() => onChange(unit.source)}
						className="gtrans-bare gtrans-h-8 gtrans-shrink-0 gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-2 gtrans-text-xs gtrans-text-label hover:gtrans-bg-body"
					>
						{__('Copy', 'gemtranslate')}
					</button>
				</div>
			</div>
			{mismatch && (
				<div className="gtrans-mt-2 gtrans-text-xs gtrans-text-amber-800">
					{sprintf(
						/* translators: 1: placeholder count in source, 2: in translation. */
						__('Source has %1$d placeholders; translation has %2$d.', 'gemtranslate'),
						countPlaceholders(unit.source),
						countPlaceholders(draft)
					)}
				</div>
			)}
		</div>
	);
}

/**
 * One image on the page. The source image is shown for reference; the
 * translation is a replacement image for this language, picked from the media
 * library. An empty choice means the page keeps showing the source image.
 */
function ImageRow({ unit, draft, onChange, onNotify }) {
	const filled = draft.trim() !== '';

	const choose = async () => {
		const url = await pickImage();
		if (url) onChange(url);
		else if (!window.wp?.media) {
			onNotify?.({ tone: 'error', message: __('The media library is not available on this screen.', 'gemtranslate') });
		}
	};

	return (
		<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-p-3">
			<div className="gtrans-mb-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
				<code title={unit.type}>{unit.label}</code>
				{unit.count > 1 && (
					<span className="gtrans-text-muted">
						{sprintf(
							/* translators: %d: number of places the same image is used. */
							__('used %d×', 'gemtranslate'),
							unit.count
						)}
					</span>
				)}
				<span
					className={clsx(
						'gtrans-ml-auto gtrans-rounded gtrans-px-2 gtrans-py-0.5',
						filled ? 'gtrans-bg-emerald-100 gtrans-text-emerald-800' : 'gtrans-bg-body gtrans-text-muted'
					)}
				>
					{filled ? __('Custom image', 'gemtranslate') : __('Same as source', 'gemtranslate')}
				</span>
			</div>
			<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-3">
				<ImageBox url={unit.source} label={__('Source image', 'gemtranslate')} />
				<div className="gtrans-flex gtrans-flex-col gtrans-gap-2">
					<ImageBox url={draft} label={__('Image for this language', 'gemtranslate')} empty={__('No replacement. The source image is shown.', 'gemtranslate')} />
					<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-2">
						<button
							type="button"
							onClick={choose}
							className="gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-text-label hover:gtrans-bg-body"
						>
							{filled ? __('Change image', 'gemtranslate') : __('Choose image', 'gemtranslate')}
						</button>
						{filled && (
							<button
								type="button"
								onClick={() => onChange('')}
								className="gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-text-label hover:gtrans-bg-body"
							>
								{__('Use source image', 'gemtranslate')}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function ImageBox({ url, label, empty }) {
	return (
		<div>
			<div className="gtrans-mb-1 gtrans-text-xs gtrans-text-muted">{label}</div>
			<div className="gtrans-flex gtrans-min-h-[120px] gtrans-items-center gtrans-justify-center gtrans-rounded-md gtrans-border gtrans-border-dashed gtrans-border-line gtrans-bg-body gtrans-p-2">
				{url ? (
					<img src={url} alt="" className="gtrans-max-h-48 gtrans-max-w-full gtrans-rounded gtrans-object-contain" />
				) : (
					<span className="gtrans-px-2 gtrans-text-center gtrans-text-xs gtrans-text-muted">{empty}</span>
				)}
			</div>
		</div>
	);
}

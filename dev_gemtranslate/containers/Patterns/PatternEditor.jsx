import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import SearchBox from '../../components/SearchBox';
import { TextArea } from '../../components/Input';
import { FormSkeleton, PageSkeleton } from '../../components/Skeleton';
import { PageAiButton } from '../Posts/PageAiModal';
import {
	useCreateCustomPart,
	usePatternItems,
	usePatternUnits,
	usePatternVariants,
	useRemoveCustomPart,
	useSavePatternTranslations,
} from '../../hooks/usePatterns';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';
import { canManage } from '../../lib/currentUser';
import ModeSwitcher from '../Posts/ModeSwitcher';
import CountryLayouts from './CountryLayouts';

const START_OPTIONS = [
	{
		value: 'copy',
		label: __('Copy of the original', 'gemtranslate'),
		hint: __('Start from the original blocks. Texts you translated here still apply on the site.', 'gemtranslate'),
	},
	{
		value: 'blank',
		label: __('Blank', 'gemtranslate'),
		hint: __('Start with an empty template part and build it from scratch.', 'gemtranslate'),
	},
];

/**
 * Strings only / Custom layout for one language (and country). A custom layout
 * is its own template part, shown instead of the original to that audience and
 * built in the Site Editor.
 */
function CustomLayoutSwitch({ item, lang, country, languageName, onNotify }) {
	const variants = usePatternVariants(item.id);
	const create = useCreateCustomPart();
	const remove = useRemoveCustomPart();

	if (!canManage || !variants.data) return null;

	const rule = (variants.data.rules || []).find((r) => r.lang === lang && r.country === country);
	const editUrl = rule
		? `${window.gtrans?.adminUrl || '/wp-admin/'}site-editor.php?postType=wp_template_part&postId=${encodeURIComponent(rule.use)}&canvas=edit`
		: '';

	const run = async (promise, message) => {
		try {
			await promise;
			onNotify({ tone: 'success', message });
		} catch (err) {
			onNotify({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<ModeSwitcher
			mode={rule ? 'custom_layout' : 'string_only'}
			language={languageName}
			country={country}
			variantRow={{ shadow_edit_url: editUrl }}
			startOptions={START_OPTIONS}
			customHint={__('Build a separate template part for this language in the Site Editor. Visitors in this language see it instead of the original.', 'gemtranslate')}
			chooserText={__('Where should the new template part start from? It opens in the Site Editor.', 'gemtranslate')}
			demoteConfirm={__('Show the original template part again? The custom copy stays in the Site Editor.', 'gemtranslate')}
			isPromoting={create.isPending}
			isDemoting={remove.isPending}
			onPromote={(start) =>
				run(
					create.mutateAsync({ part: item.id, lang, country, start }),
					__('Custom layout created. Use “Open in editor” to design it.', 'gemtranslate')
				)
			}
			onDemote={() => run(remove.mutateAsync({ part: item.id, lang, country }), __('Back to the original layout.', 'gemtranslate'))}
		/>
	);
}

const countPlaceholders = (s) => (String(s || '').match(/\{\d+\}/g) || []).length;

function VariantPill({ active, onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				'gtrans-bare gtrans-cursor-pointer gtrans-rounded-full gtrans-border gtrans-px-3 gtrans-py-1 gtrans-text-xs',
				active
					? 'gtrans-border-primary gtrans-bg-primary gtrans-text-white'
					: 'gtrans-border-line gtrans-bg-surface gtrans-text-label hover:gtrans-bg-body'
			)}
		>
			{children}
		</button>
	);
}

/**
 * Translate one template part, synced pattern or navigation menu. Same layout
 * as the post editor: language buttons and country pills on top, then the
 * block-wise editor (source on the left, translation on the right).
 */
export default function PatternEditor() {
	const [params] = useSearchParams();
	const itemId = params.get('item') || '';
	const items = usePatternItems();
	const languages = useLanguages();
	const [lang, setLang] = useState(params.get('lang') || '');
	const [country, setCountry] = useState('');
	const [extraCountries, setExtraCountries] = useState([]);
	const [tab, setTab] = useState('content');
	const [toast, setToast] = useState(null);

	const item = (items.data?.rows || []).find((r) => r.id === itemId);
	const targetLangs = (languages.data || []).filter((l) => !l.is_default && l.active);
	const sourceLang = (languages.data || []).find((l) => l.is_default)?.code || '';

	useEffect(() => {
		if (!lang && targetLangs.length) setLang(targetLangs[0].code);
	}, [lang, targetLangs]);

	if (items.isLoading || languages.isLoading) return <PageSkeleton />;

	const back = (
		<Link to="/patterns" className="gtrans-text-sm gtrans-text-primary gtrans-no-underline">
			{__('← Back to patterns', 'gemtranslate')}
		</Link>
	);

	if (!item || targetLangs.length === 0) {
		return (
			<>
				<PageHeader title={__('Patterns', 'gemtranslate')} actions={back} />
				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{targetLangs.length === 0
							? __('Add at least one non-default language to start translating patterns.', 'gemtranslate')
							: __('Pattern not found. It may have been removed or have no translatable text.', 'gemtranslate')}
					</p>
				</Card>
			</>
		);
	}

	const countries = [...new Set([...(items.data?.meta?.countries?.[lang] || []), ...extraCountries])];

	const addCountry = () => {
		// eslint-disable-next-line no-alert
		const next = (window.prompt(__('ISO 2-letter country code (e.g. CA)', 'gemtranslate')) || '').trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(next)) return;
		setExtraCountries((e) => [...e, next]);
		setCountry(next);
	};

	const dotFor = (code) => {
		const done = item.progress?.[code] || 0;
		if (done >= item.total) return 'gtrans-bg-emerald-400';
		return done > 0 ? 'gtrans-bg-amber-400' : 'gtrans-bg-gray-300';
	};

	const tabs = [
		{ key: 'content', label: __('Content', 'gemtranslate') },
		...(item.type === 'template_part' ? [{ key: 'layouts', label: __('Country layouts', 'gemtranslate') }] : []),
	];

	return (
		<>
			<div className="gtrans-sticky-head gtrans-sticky-head--gap">
				<header className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-x-4 gtrans-gap-y-1 gtrans-pb-3">
					<div className="gtrans-min-w-0">
						<h1 className="gtrans-m-0 gtrans-truncate gtrans-text-xl gtrans-font-semibold gtrans-text-heading">
							{sprintf(/* translators: %s: pattern name. */ __('Translate: %s', 'gemtranslate'), item.title)}
						</h1>
						<p className="gtrans-m-0 gtrans-text-xs gtrans-text-description">
							{sprintf(/* translators: %s: source language code. */ __('Source language: %s', 'gemtranslate'), sourceLang)}
						</p>
					</div>
					{back}
				</header>

				<div className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-px-5">
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-x-5 gtrans-gap-y-2 gtrans-border-b gtrans-border-line gtrans-py-3">
						<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1.5">
							{targetLangs.map((l) => (
								<button
									key={l.code}
									type="button"
									onClick={() => {
										setLang(l.code);
										setCountry('');
										setExtraCountries([]);
									}}
									className={clsx(
										'gtrans-bare gtrans-inline-flex gtrans-cursor-pointer gtrans-items-center gtrans-gap-2 gtrans-rounded-md gtrans-border gtrans-px-3 gtrans-py-1.5 gtrans-text-sm',
										lang === l.code
											? 'gtrans-border-primary gtrans-bg-primary gtrans-text-white'
											: 'gtrans-border-line gtrans-bg-surface gtrans-text-label hover:gtrans-bg-body'
									)}
								>
									<span aria-hidden="true" className={clsx('gtrans-h-2 gtrans-w-2 gtrans-rounded-full', dotFor(l.code))} />
									{l.name}
								</button>
							))}
						</div>

						<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1.5">
							<span className="gtrans-text-xs gtrans-text-muted">{__('Country:', 'gemtranslate')}</span>
							<VariantPill active={country === ''} onClick={() => setCountry('')}>
								{__('Default', 'gemtranslate')}
							</VariantPill>
							{countries.map((c) => (
								<VariantPill key={c} active={country === c} onClick={() => setCountry(c)}>
									{c}
								</VariantPill>
							))}
							<button
								type="button"
								onClick={addCountry}
								className="gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-bg-transparent gtrans-px-1 gtrans-text-xs gtrans-text-primary hover:gtrans-underline"
							>
								{__('+ Add', 'gemtranslate')}
							</button>
							{item.type === 'template_part' && (
								<CustomLayoutSwitch
									item={item}
									lang={lang}
									country={country}
									languageName={targetLangs.find((l) => l.code === lang)?.name || lang}
									onNotify={setToast}
								/>
							)}
						</div>
					</div>

					<div className="gtrans-flex">
						{tabs.map((t) => (
							<button
								key={t.key}
								type="button"
								onClick={() => setTab(t.key)}
								className={clsx(
									'gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-border-b-2 gtrans-bg-transparent gtrans-px-4 gtrans-py-3 gtrans-text-sm',
									tab === t.key
										? 'gtrans-border-primary gtrans-text-primary gtrans-font-semibold'
										: 'gtrans-border-transparent gtrans-text-muted hover:gtrans-text-ink'
								)}
								style={{ borderBottomStyle: 'solid' }}
							>
								{t.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="gtrans-pt-1">
				{tab === 'layouts' ? (
					<CountryLayouts part={item.id} title={item.title} languages={targetLangs} onNotify={setToast} />
				) : (
					<ContentEditor
						key={`${item.id}:${lang}:${country}`}
						item={item}
						lang={lang}
						country={country}
						sourceLang={sourceLang}
						onNotify={setToast}
					/>
				)}
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

function ContentEditor({ item, lang, country, sourceLang, onNotify }) {
	const data = usePatternUnits(item.id, lang, country);
	const save = useSavePatternTranslations();
	const [drafts, setDrafts] = useState({});
	const [filter, setFilter] = useState('all');
	const [search, setSearch] = useState('');

	const units = data.data || [];
	useEffect(() => {
		const init = {};
		units.forEach((u) => { init[u.source] = u.translation; });
		setDrafts(init);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.data]);

	const valueOf = (u) => drafts[u.source] ?? u.translation;
	const changed = useMemo(() => units.filter((u) => (drafts[u.source] ?? u.translation) !== u.translation), [units, drafts]);
	const done = units.filter((u) => valueOf(u).trim() !== '').length;

	const saveRef = useRef(null);
	useEffect(() => {
		const onKey = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
				e.preventDefault();
				saveRef.current?.();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const submit = async () => {
		if (changed.length === 0) return;
		try {
			await save.mutateAsync({
				lang,
				country,
				units: changed.map((u) => ({ source: u.source, translation: drafts[u.source] ?? '' })),
			});
			onNotify({ tone: 'success', message: __('Translations saved.', 'gemtranslate') });
		} catch (err) {
			onNotify({ tone: 'error', message: formatErrorMessage(err) });
		}
	};
	saveRef.current = submit;

	const copyAllEmpty = () =>
		setDrafts((d) => {
			const next = { ...d };
			units.forEach((u) => { if (!(next[u.source] ?? '').trim()) next[u.source] = u.source.trim(); });
			return next;
		});

	const q = search.trim().toLowerCase();
	const shown = units.filter((u) => {
		const filled = valueOf(u).trim() !== '';
		if (filter === 'todo' && filled) return false;
		if (filter === 'done' && !filled) return false;
		return !q || u.source.toLowerCase().includes(q) || valueOf(u).toLowerCase().includes(q);
	});

	if (data.isLoading) return <FormSkeleton />;

	return (
		<Card
			title={
				country
					? sprintf(/* translators: 1: pattern name, 2: country code. */ __('Block-wise translation · %1$s · %2$s', 'gemtranslate'), item.title, country)
					: sprintf(/* translators: %s: pattern name. */ __('Block-wise translation · %s', 'gemtranslate'), item.title)
			}
		>
			<p className="gtrans-mb-3 gtrans-mt-0 gtrans-text-xs gtrans-text-muted">
				{country
					? __('Texts you fill in here are shown only to visitors from this country. Empty ones keep using the language text.', 'gemtranslate')
					: __('Translate each text on its own. Block structure and styling follow the source; use {1} {2} placeholders to keep bold text, links and line breaks.', 'gemtranslate')}
			</p>
			{units.length === 0 && (
				<p className="gtrans-text-sm gtrans-text-muted">{__('Nothing to translate here.', 'gemtranslate')}</p>
			)}

			<div className="gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
				<div className="gtrans-min-w-[160px]">
					<div className="gtrans-mb-1 gtrans-text-xs gtrans-text-label">
						{country
							? sprintf(/* translators: 1: customised count, 2: total, 3: country. */ __('%1$d of %2$d customised for %3$s', 'gemtranslate'), done, units.length, country)
							: sprintf(/* translators: 1: translated count, 2: total count. */ __('%1$d of %2$d translated', 'gemtranslate'), done, units.length)}
					</div>
					<div className="gtrans-h-1.5 gtrans-w-full gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-body">
						<div className="gtrans-h-full gtrans-bg-emerald-400" style={{ width: `${units.length ? (done / units.length) * 100 : 0}%` }} />
					</div>
				</div>
				<div className="gtrans-inline-flex">
					{[
						{ k: 'all', l: __('All', 'gemtranslate') },
						{ k: 'todo', l: country ? __('Uses language text', 'gemtranslate') : __('Untranslated', 'gemtranslate') },
						{ k: 'done', l: country ? __('Country text', 'gemtranslate') : __('Translated', 'gemtranslate') },
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
				<SearchBox value={search} onSearch={setSearch} placeholder={__('Search texts…', 'gemtranslate')} delay={200} />
				<div className="gtrans-ml-auto gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2">
					{!country && (
						<PageAiButton
							items={units.map((u) => ({ key: u.source, source: u.source, context: u.label }))}
							drafts={drafts}
							pageTitle={item.title}
							slug={item.id}
							sourceLang={sourceLang}
							targetLang={lang}
							onApply={(map) => setDrafts((d) => ({ ...d, ...map }))}
							onNotify={onNotify}
						/>
					)}
					{!country && (
						<Button type="button" variant="secondary" size="sm" onClick={copyAllEmpty}>
							{__('Copy source to empty', 'gemtranslate')}
						</Button>
					)}
					<Button type="button" size="sm" loading={save.isPending} disabled={changed.length === 0} onClick={submit}>
						{changed.length
							? sprintf(/* translators: %d: unsaved texts. */ __('Save all (%d)', 'gemtranslate'), changed.length)
							: __('Save all', 'gemtranslate')}
					</Button>
				</div>
			</div>

			<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
				{shown.map((u) => (
					<UnitRow
						key={u.source}
						unit={u}
						draft={valueOf(u)}
						country={country}
						onChange={(v) => setDrafts((d) => ({ ...d, [u.source]: v }))}
					/>
				))}
				{shown.length === 0 && units.length > 0 && (
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('No texts match this filter.', 'gemtranslate')}</p>
				)}
			</div>
		</Card>
	);
}

function UnitRow({ unit, draft, country, onChange }) {
	const filled = draft.trim() !== '';
	const mismatch = filled && countPlaceholders(draft) !== countPlaceholders(unit.source);
	const source = unit.source.trim();
	const rows = Math.min(8, Math.max(3, Math.ceil(source.length / 70)));
	const copyText = country ? unit.fallback || source : source;

	return (
		<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-p-3">
			<div className="gtrans-mb-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
				<code>{unit.label}</code>
				<span
					className={clsx(
						'gtrans-ml-auto gtrans-rounded gtrans-px-2 gtrans-py-0.5',
						filled ? 'gtrans-bg-emerald-100 gtrans-text-emerald-800' : 'gtrans-bg-body gtrans-text-muted'
					)}
				>
					{country
						? filled ? __('Country text', 'gemtranslate') : __('Uses language text', 'gemtranslate')
						: filled ? __('Translated', 'gemtranslate') : __('Untranslated', 'gemtranslate')}
				</span>
			</div>
			<div className="gtrans-grid gtrans-grid-cols-1 gtrans-gap-3 lg:gtrans-grid-cols-2">
				<TextArea rows={rows} value={source} readOnly className="gtrans-bg-body" aria-label={__('Source', 'gemtranslate')} />
				<div className="gtrans-flex gtrans-gap-2">
					<TextArea
						rows={rows}
						value={draft}
						onChange={(e) => onChange(e.target.value)}
						placeholder={country ? copyText : __('Translation', 'gemtranslate')}
						aria-label={__('Translation', 'gemtranslate')}
					/>
					<button
						type="button"
						title={__('Copy source', 'gemtranslate')}
						onClick={() => onChange(copyText)}
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

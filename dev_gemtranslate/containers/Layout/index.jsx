import { useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import SearchBox from '../../components/SearchBox';
import { TextArea } from '../../components/Input';
import { Select } from '../../components/ui/Select';
import { PageSkeleton, FormSkeleton } from '../../components/Skeleton';
import { PageAiButton } from '../Posts/PageAiModal';
import { useLanguages } from '../../hooks/useLanguages';
import { useLayoutItems, useLayoutUnits, useSaveLayoutTranslations } from '../../hooks/useLayout';
import { formatErrorMessage } from '../../lib/format';

const countPlaceholders = (s) => (String(s || '').match(/\{\d+\}/g) || []).length;

const GROUPS = () => [
	{ type: 'template_part', label: __('Header, footer & template parts', 'gemtranslate') },
	{ type: 'pattern', label: __('Synced patterns', 'gemtranslate') },
	{ type: 'navigation', label: __('Navigation menus', 'gemtranslate') },
];

function ProgressBar({ done, total }) {
	return (
		<div className="gtrans-h-1.5 gtrans-w-full gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-body">
			<div
				className={clsx('gtrans-h-full', done === total ? 'gtrans-bg-emerald-500' : 'gtrans-bg-emerald-400')}
				style={{ width: `${total ? (done / total) * 100 : 0}%` }}
			/>
		</div>
	);
}

function ItemList({ rows, itemId, onSelect }) {
	return (
		<Card>
			{GROUPS().map((g) => {
				const group = rows.filter((r) => r.type === g.type);
				if (!group.length) return null;
				return (
					<div key={g.type} className="gtrans-mb-4 last:gtrans-mb-0">
						<div className="gtrans-mb-2 gtrans-text-xs gtrans-font-semibold gtrans-uppercase gtrans-tracking-wide gtrans-text-muted">
							{g.label}
						</div>
						<ul className="gtrans-m-0 gtrans-flex gtrans-list-none gtrans-flex-col gtrans-gap-1 gtrans-p-0">
							{group.map((r) => (
								<li key={r.id}>
									<button
										type="button"
										onClick={() => onSelect(r.id)}
										className={clsx(
											'gtrans-bare gtrans-block gtrans-w-full gtrans-cursor-pointer gtrans-rounded-md gtrans-border-0 gtrans-px-3 gtrans-py-2 gtrans-text-left',
											r.id === itemId ? 'gtrans-bg-primary-light' : 'gtrans-bg-transparent hover:gtrans-bg-body'
										)}
									>
										<div className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-gap-2 gtrans-text-sm gtrans-text-ink">
											<span className={clsx(r.id === itemId && 'gtrans-font-medium')}>{r.title}</span>
											<span className="gtrans-text-xs gtrans-text-muted">{r.done}/{r.total}</span>
										</div>
										<div className="gtrans-mt-1.5">
											<ProgressBar done={r.done} total={r.total} />
										</div>
									</button>
								</li>
							))}
						</ul>
					</div>
				);
			})}
		</Card>
	);
}

function UnitRow({ unit, draft, onChange, country }) {
	const filled = draft.trim() !== '';
	const mismatch = filled && countPlaceholders(draft) !== countPlaceholders(unit.source);
	const source = unit.source.trim();
	const rows = Math.min(6, Math.max(2, Math.ceil(source.length / 60)));

	return (
		<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-p-3">
			<div className="gtrans-mb-2 gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-xs">
				<span className="gtrans-text-muted">{unit.label}</span>
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
				<TextArea
					rows={rows}
					value={source}
					readOnly
					className="gtrans-bg-body gtrans-font-sans"
					aria-label={__('Source', 'gemtranslate')}
				/>
				<div className="gtrans-flex gtrans-gap-2">
					<TextArea
						rows={rows}
						value={draft}
						onChange={(e) => onChange(e.target.value)}
						className="gtrans-font-sans"
						placeholder={country ? unit.fallback || source : __('Translation', 'gemtranslate')}
						aria-label={__('Translation', 'gemtranslate')}
					/>
					<button
						type="button"
						title={__('Copy source', 'gemtranslate')}
						onClick={() => onChange(country ? unit.fallback || source : source)}
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

function Editor({ item, lang, country, sourceLang, onNotify }) {
	const data = useLayoutUnits(item.id, lang, country);
	const save = useSaveLayoutTranslations();
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

	const changed = useMemo(() => units.filter((u) => (drafts[u.source] ?? '') !== u.translation), [units, drafts]);
	const done = units.filter((u) => (drafts[u.source] ?? '').trim() !== '').length;

	const shown = units.filter((u) => {
		const filled = (drafts[u.source] ?? '').trim() !== '';
		if (filter === 'todo' && filled) return false;
		if (filter === 'done' && !filled) return false;
		const q = search.trim().toLowerCase();
		return !q || u.source.toLowerCase().includes(q) || (drafts[u.source] ?? '').toLowerCase().includes(q);
	});

	const submit = async () => {
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

	const copyAllEmpty = () =>
		setDrafts((d) => {
			const next = { ...d };
			units.forEach((u) => { if (!(next[u.source] ?? '').trim()) next[u.source] = u.source.trim(); });
			return next;
		});

	return (
		<Card title={item.title}>
			{data.isLoading ? (
				<FormSkeleton />
			) : (
				<>
					<div className="gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
						<div className="gtrans-min-w-[160px]">
							<div className="gtrans-mb-1 gtrans-text-xs gtrans-text-label">
								{country
									? sprintf(
											/* translators: 1: customised count, 2: total count, 3: country code. */
											__('%1$d of %2$d customised for %3$s', 'gemtranslate'),
											done,
											units.length,
											country
										)
									: sprintf(
											/* translators: 1: translated count, 2: total count. */
											__('%1$d of %2$d translated', 'gemtranslate'),
											done,
											units.length
										)}
							</div>
							<ProgressBar done={done} total={units.length} />
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
								draft={drafts[u.source] ?? ''}
								onChange={(v) => setDrafts((d) => ({ ...d, [u.source]: v }))}
								country={country}
							/>
						))}
						{shown.length === 0 && (
							<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('No texts match this filter.', 'gemtranslate')}</p>
						)}
					</div>
				</>
			)}
		</Card>
	);
}

export default function LayoutPage() {
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default && l.active);
	const sourceLang = (langs.data || []).find((l) => l.is_default)?.code || '';
	const [lang, setLang] = useState('');
	const [country, setCountry] = useState('');
	const [itemId, setItemId] = useState('');
	const [toast, setToast] = useState(null);
	const items = useLayoutItems(lang, country);
	const countries = items.data?.meta?.countries || [];
	const [extra, setExtra] = useState([]);
	const pills = [...new Set([...countries, ...extra])];
	const rows = items.data?.rows || [];
	const item = rows.find((r) => r.id === itemId);

	useEffect(() => {
		if (!lang && nonDefault.length) setLang(nonDefault[0].code);
	}, [nonDefault, lang]);
	useEffect(() => {
		if (rows.length && !rows.some((r) => r.id === itemId)) setItemId(rows[0].id);
	}, [rows, itemId]);

	if (langs.isLoading || (lang && items.isLoading && !items.data)) return <PageSkeleton />;

	const addCountry = () => {
		const next = (window.prompt(__('ISO 2-letter country code (e.g. CA)', 'gemtranslate')) || '').trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(next)) return;
		setExtra((e) => [...e, next]);
		setCountry(next);
	};

	return (
		<>
			<PageHeader
				title={__('Header, footer & patterns', 'gemtranslate')}
				description={__(
					'Translate the site-wide parts of a block theme. A text is translated once and applies everywhere it appears.',
					'gemtranslate'
				)}
				actions={
					<label className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-xs gtrans-text-muted">
						{__('Language', 'gemtranslate')}
						<Select className="gtrans-min-w-[160px]" value={lang} onChange={(e) => { setLang(e.target.value); setCountry(''); setExtra([]); }}>
							{nonDefault.map((l) => (
								<option key={l.code} value={l.code}>{l.name}</option>
							))}
						</Select>
					</label>
				}
			/>

			{nonDefault.length > 0 && (
				<div className="gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
					<span className="gtrans-text-muted">{__('Show for', 'gemtranslate')}</span>
					{['', ...pills].map((c) => (
						<button
							key={c || 'all'}
							type="button"
							onClick={() => setCountry(c)}
							className={clsx(
								'gtrans-bare gtrans-cursor-pointer gtrans-rounded-full gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-1',
								country === c ? 'gtrans-bg-primary gtrans-text-white' : 'gtrans-bg-surface gtrans-text-label'
							)}
						>
							{c || __('All countries', 'gemtranslate')}
						</button>
					))}
					<button
						type="button"
						onClick={addCountry}
						className="gtrans-bare gtrans-cursor-pointer gtrans-rounded-full gtrans-border gtrans-border-dashed gtrans-border-line gtrans-bg-transparent gtrans-px-3 gtrans-py-1 gtrans-text-label"
					>
						+ {__('Add country', 'gemtranslate')}
					</button>
				</div>
			)}

			{nonDefault.length === 0 ? (
				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{__('Add a language first, then come back to translate your header and footer.', 'gemtranslate')}
					</p>
				</Card>
			) : rows.length === 0 ? (
				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{__('No translatable text found in template parts, patterns or navigation menus. This needs a block theme.', 'gemtranslate')}
					</p>
				</Card>
			) : (
				<div className="gtrans-grid gtrans-grid-cols-1 gtrans-items-start gtrans-gap-4 lg:gtrans-grid-cols-[280px_minmax(0,1fr)]">
					<ItemList rows={rows} itemId={itemId} onSelect={setItemId} />
					{item && <Editor key={`${item.id}:${lang}:${country}`} item={item} lang={lang} country={country} sourceLang={sourceLang} onNotify={setToast} />}
				</div>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

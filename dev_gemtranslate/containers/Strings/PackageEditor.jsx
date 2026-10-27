import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { TextArea, TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useStrings } from '../../hooks/useStrings';
import {
	useBulkSaveStrings,
	useExportPackage,
	useMemorySuggestions,
	usePackages,
	useScanPackage,
	useTranslateAllInPackage,
} from '../../hooks/usePackages';
import { useLanguages } from '../../hooks/useLanguages';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

const PAGE_SIZE = 50;

export default function PackageEditor() {
	const { slug, lang } = useParams();
	const navigate = useNavigate();
	const packages = usePackages();
	const languages = useLanguages();
	const scan = useScanPackage();
	const ai = useTranslateWithAI();
	const bulkAI = useTranslateAllInPackage();
	const bulkSave = useBulkSaveStrings();
	const exportPack = useExportPackage();
	const memorySuggestions = useMemorySuggestions();

	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [searchDraft, setSearchDraft] = useState('');
	const [statusFilter, setStatusFilter] = useState('all'); // all | untranslated | translated
	const [drafts, setDrafts] = useState({}); // string_id -> {value, dirty}
	const [memoryHits, setMemoryHits] = useState({}); // string_id -> suggested value
	const [toast, setToast] = useState(null);

	const pkg = (packages.data?.rows || []).find((p) => p.slug === slug) || null;
	const targetLangs = (languages.data || []).filter((l) => !l.is_default);
	const langRow = (languages.data || []).find((l) => l.code === lang);
	const defaultLang = (languages.data || []).find((l) => l.is_default);

	const apiStatus = statusFilter === 'all' ? '' : statusFilter;
	const strings = useStrings({
		domain: pkg?.text_domain || '',
		lang,
		page,
		per_page: PAGE_SIZE,
		search,
		status: apiStatus,
	});

	// On data load, pre-populate drafts from existing translations (so editing
	// reflects current saved value) and request TM suggestions for empty rows.
	useEffect(() => {
		if (!strings.data) return;
		setDrafts((d) => {
			const next = { ...d };
			(strings.data.rows || []).forEach((row) => {
				if (next[row.string_id]) return; // preserve dirty edits across page changes
				next[row.string_id] = {
					value: row.translation || '',
					dirty: false,
					status: row.translation_status || '',
				};
			});
			return next;
		});

		// Request TM suggestions for rows that have NO translation in this language.
		const candidates = (strings.data.rows || [])
			.filter((r) => !r.translation || r.translation === '')
			.map((r) => r.string_id);
		if (candidates.length === 0 || !slug || !lang) return;
		memorySuggestions.mutateAsync({ slug, lang, string_ids: candidates })
			.then((hits) => {
				if (!hits || typeof hits !== 'object') return;
				setMemoryHits((m) => ({ ...m, ...hits }));
			})
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [strings.data, slug, lang]);

	if (packages.isLoading || strings.isLoading || languages.isLoading) {
		return <LoadingBlock>{__('Loading…', 'gemtranslate')}</LoadingBlock>;
	}
	if (!pkg) {
		return (
			<>
				<PageHeader title={__('Strings', 'gemtranslate')} />
				<Card>
					<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
						{__('Package not found. It may have been uninstalled.', 'gemtranslate')}{' '}
						<Link to="/strings" className="ztrans-text-ztrans-primary">
							{__('← Back to plugins & themes', 'gemtranslate')}
						</Link>
					</p>
				</Card>
			</>
		);
	}

	const rows = strings.data?.rows || [];
	const total = strings.data?.meta?.total || 0;
	const dirtyCount = Object.values(drafts).filter((d) => d.dirty).length;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const stats = pkg.per_lang?.[lang] || { total: pkg.string_count, translated: 0, wp_org: 0, draft: 0, missing: pkg.string_count };
	const doneCount = stats.translated + stats.wp_org + stats.draft;

	const onChange = (id, value) => {
		setDrafts((d) => ({
			...d,
			[id]: { ...(d[id] || {}), value, dirty: true },
		}));
	};

	const onAiOne = async (row) => {
		try {
			const res = await ai.mutateAsync({
				text: row.source,
				source_lang: defaultLang?.code || 'en',
				target_lang: lang,
				preserve_html: false,
				use_memory: true,
			});
			onChange(row.string_id, res.translations);
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onUseSuggestion = (id, value) => {
		onChange(id, value);
	};

	const runSearch = (e) => {
		e.preventDefault();
		setPage(1);
		setSearch(searchDraft);
	};

	const onSaveAll = async () => {
		const translations = Object.entries(drafts)
			.filter(([, d]) => d.dirty)
			.map(([id, d]) => ({
				string_id: Number(id),
				language_code: lang,
				value: d.value,
				status: 'translated',
			}));
		if (translations.length === 0) return;
		try {
			const result = await bulkSave.mutateAsync({ translations });
			setDrafts((d) => {
				const next = { ...d };
				translations.forEach((t) => {
					if (next[t.string_id]) next[t.string_id] = { ...next[t.string_id], dirty: false, status: 'translated' };
				});
				return next;
			});
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: %d: count saved. */
					__('Saved %d translations.', 'gemtranslate'),
					result?.saved ?? translations.length
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onTranslateAll = async () => {
		try {
			const result = await bulkAI.mutateAsync({ slug, lang, status: 'draft' });
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: total translated, 2: from memory, 3: from AI. */
					__('Translated %1$d strings (%2$d from memory, %3$d from AI).', 'gemtranslate'),
					result?.translated ?? 0,
					result?.from_memory ?? 0,
					result?.from_ai ?? 0
				),
			});
			// Drop drafts so the refetched data lands; React Query already invalidated.
			setDrafts({});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onRescan = async () => {
		try {
			const result = await scan.mutateAsync({ slug });
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: string count, 2: WP.org imports. */
					__('Re-scanned — %1$d strings, %2$d community translations imported.', 'gemtranslate'),
					result?.string_count ?? 0,
					result?.wporg?.imported ?? 0
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onExport = async (opts = {}) => {
		try {
			const result = await exportPack.mutateAsync({ slug, lang, ...opts });
			const where = (result?.paths || [])[0] || '';
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: written count, 2: file path. */
					__('Wrote %1$d translations to %2$s', 'gemtranslate'),
					result?.written ?? 0,
					where
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const wpOrgProjectUrl = pkg.wp_org_hosted
		? (pkg.type === 'theme'
			? `https://translate.wordpress.org/projects/wp-themes/${pkg.slug}/${lang}/default/`
			: `https://translate.wordpress.org/projects/wp-plugins/${pkg.slug}/dev/${lang}/default/`)
		: '';

	return (
		<>
			<PageHeader
				title={`${pkg.name} · ${langRow?.name || lang}`}
				description={
					<span>
						<code>{pkg.text_domain}</code> ·{' '}
						{sprintf(
							/* translators: 1: done count, 2: total. */
							__('%1$d / %2$d translated', 'gemtranslate'),
							doneCount,
							stats.total || 0
						)}
					</span>
				}
				actions={
					<Link
						to="/strings"
						className="ztrans-text-sm ztrans-text-ztrans-primary ztrans-no-underline"
					>
						{__('← Back to plugins', 'gemtranslate')}
					</Link>
				}
			/>

			<Card padded={false}>
				{/* ---- Toolbar ---- */}
				<div className="ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-2 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3">
					<div className="ztrans-flex ztrans-items-center ztrans-gap-1 ztrans-text-xs">
						<span className="ztrans-mr-1 ztrans-text-ztrans-muted">{__('Language:', 'gemtranslate')}</span>
						<select
							value={lang}
							onChange={(e) => navigate(`/strings/${slug}/${e.target.value}`)}
							className="ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-px-2 ztrans-py-1 ztrans-text-xs"
						>
							{targetLangs.map((l) => (
								<option key={l.code} value={l.code}>
									{l.name} ({l.code})
								</option>
							))}
						</select>
					</div>

					<div className="ztrans-flex ztrans-items-center ztrans-gap-1 ztrans-ml-2">
						{[
							{ key: 'all', label: __('All', 'gemtranslate') },
							{ key: 'untranslated', label: __('Untranslated', 'gemtranslate') },
							{ key: 'translated', label: __('Translated', 'gemtranslate') },
						].map((f) => (
							<button
								key={f.key}
								type="button"
								onClick={() => {
									setStatusFilter(f.key);
									setPage(1);
								}}
								className={`ztrans-bare ztrans-rounded-full ztrans-px-3 ztrans-py-1 ztrans-text-xs ${
									statusFilter === f.key
										? 'ztrans-bg-ztrans-primary ztrans-text-white'
										: 'ztrans-bg-white ztrans-border ztrans-border-ztrans-border ztrans-text-gray-700'
								}`}
							>
								{f.label}
							</button>
						))}
					</div>

					<form onSubmit={runSearch} className="ztrans-flex ztrans-items-center ztrans-gap-1">
						<TextInput
							value={searchDraft}
							onChange={(e) => setSearchDraft(e.target.value)}
							placeholder={__('Search…', 'gemtranslate')}
						/>
						<Button type="submit" variant="ghost" size="sm">{__('Filter', 'gemtranslate')}</Button>
					</form>

					<span className="ztrans-ml-auto ztrans-flex ztrans-items-center ztrans-gap-2">
						<Button
							size="sm"
							variant="secondary"
							loading={bulkAI.isPending}
							onClick={onTranslateAll}
						>
							{__('Translate all untranslated with AI', 'gemtranslate')}
						</Button>
						<Button size="sm" variant="ghost" loading={scan.isPending} onClick={onRescan}>
							{__('Re-scan', 'gemtranslate')}
						</Button>
						<ExportMenu
							onExport={onExport}
							loading={exportPack.isPending}
							pkg={pkg}
							lang={lang}
							wpOrgProjectUrl={wpOrgProjectUrl}
						/>
						<Button
							size="sm"
							loading={bulkSave.isPending}
							disabled={dirtyCount === 0}
							onClick={onSaveAll}
						>
							{dirtyCount > 0
								? sprintf(
										/* translators: %d: dirty count. */
										__('Save all (%d)', 'gemtranslate'),
										dirtyCount
								  )
								: __('Save all', 'gemtranslate')}
						</Button>
					</span>
				</div>

				{/* ---- Rows ---- */}
				{rows.length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-10 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{statusFilter === 'untranslated'
							? __('Nothing untranslated. Nice work.', 'gemtranslate')
							: __('No strings match.', 'gemtranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-1/2">{__('Source', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Translation', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-24" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<StringRow
									key={row.string_id}
									row={row}
									draft={drafts[row.string_id]}
									suggestion={memoryHits[row.string_id]}
									wpOrgProjectUrl={wpOrgProjectUrl}
									onChange={onChange}
									onAi={onAiOne}
									onUseSuggestion={onUseSuggestion}
									aiBusy={ai.isPending}
								/>
							))}
						</tbody>
					</table>
				)}

				{/* ---- Pagination ---- */}
				{total > PAGE_SIZE && (
					<div className="ztrans-flex ztrans-items-center ztrans-justify-between ztrans-border-t ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm">
						<span className="ztrans-text-ztrans-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages, 3: total rows. */
								__('Page %1$d of %2$d · %3$d total', 'gemtranslate'),
								page,
								totalPages,
								total
							)}
						</span>
						<div className="ztrans-flex ztrans-gap-2">
							<Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
								{__('Previous', 'gemtranslate')}
							</Button>
							<Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
								{__('Next', 'gemtranslate')}
							</Button>
						</div>
					</div>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

function StringRow({ row, draft, suggestion, wpOrgProjectUrl, onChange, onAi, onUseSuggestion, aiBusy }) {
	const value = draft?.value ?? row.translation ?? '';
	const dirty = draft?.dirty;
	const status = draft?.status || row.translation_status || '';
	const fromWpOrg = status === 'wp_org';
	const hasSuggestion = !value && suggestion;

	return (
		<tr
			className={`ztrans-border-t ztrans-border-ztrans-border ztrans-align-top ${
				dirty ? 'ztrans-bg-amber-50' : ''
			}`}
		>
			<td className="ztrans-px-4 ztrans-py-3">
				<div className="ztrans-text-gray-900">{row.source}</div>
				{row.file_ref && (
					<div className="ztrans-mt-1 ztrans-text-xs ztrans-text-ztrans-muted">
						<code>{row.file_ref}</code>
					</div>
				)}
				{row.context && (
					<div className="ztrans-mt-1 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Context', 'gemtranslate')}: <code>{row.context}</code>
					</div>
				)}
			</td>
			<td className="ztrans-px-4 ztrans-py-3">
				<TextArea
					rows={Math.min(6, Math.max(2, Math.ceil((row.source?.length || 0) / 80)))}
					value={value}
					onChange={(e) => onChange(row.string_id, e.target.value)}
				/>
				<div className="ztrans-mt-1 ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-2 ztrans-text-xs">
					{fromWpOrg && (
						<span className="ztrans-rounded ztrans-bg-emerald-100 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-emerald-800">
							🌐 {__('From translate.wordpress.org', 'gemtranslate')}
						</span>
					)}
					{status === 'translated' && !dirty && (
						<span className="ztrans-rounded ztrans-bg-blue-100 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-blue-800">
							{__('Translated', 'gemtranslate')}
						</span>
					)}
					{status === 'draft' && (
						<span className="ztrans-rounded ztrans-bg-gray-100 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-gray-700">
							{__('Draft', 'gemtranslate')}
						</span>
					)}
					{dirty && (
						<span className="ztrans-rounded ztrans-bg-amber-100 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-amber-800">
							{__('Unsaved', 'gemtranslate')}
						</span>
					)}
					{hasSuggestion && (
						<button
							type="button"
							onClick={() => onUseSuggestion(row.string_id, suggestion)}
							className="ztrans-bare ztrans-inline-flex ztrans-items-center ztrans-gap-1 ztrans-rounded ztrans-bg-indigo-50 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-indigo-700 hover:ztrans-bg-indigo-100"
							title={suggestion}
						>
							💡 {__('Used elsewhere:', 'gemtranslate')}{' '}
							<span className="ztrans-italic">{truncate(suggestion, 40)}</span>
							<span className="ztrans-ml-1 ztrans-font-semibold">{__('Use', 'gemtranslate')}</span>
						</button>
					)}
					{wpOrgProjectUrl && status === 'translated' && !dirty && (
						<a
							href={`${wpOrgProjectUrl}?filters[term]=${encodeURIComponent(row.source)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="ztrans-text-[11px] ztrans-text-ztrans-muted ztrans-no-underline hover:ztrans-text-ztrans-primary"
						>
							{__('Suggest on WP.org →', 'gemtranslate')}
						</a>
					)}
				</div>
			</td>
			<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
				<Button size="sm" variant="ghost" loading={aiBusy} onClick={() => onAi(row)}>
					{__('AI', 'gemtranslate')}
				</Button>
			</td>
		</tr>
	);
}

function ExportMenu({ onExport, loading, pkg, lang, wpOrgProjectUrl }) {
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);

	return (
		<div className="ztrans-relative">
			<Button size="sm" variant="ghost" loading={loading} onClick={() => setOpen((o) => !o)}>
				{__('Export ▾', 'gemtranslate')}
			</Button>
			{open && (
				<div
					className="ztrans-absolute ztrans-right-0 ztrans-z-10 ztrans-mt-1 ztrans-w-72 ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-shadow-card"
					onMouseLeave={close}
				>
					<button
						type="button"
						onClick={() => { close(); onExport({ exclude_status: '' }); }}
						className="ztrans-bare ztrans-block ztrans-w-full ztrans-px-3 ztrans-py-2 ztrans-text-left ztrans-text-sm hover:ztrans-bg-gray-50"
					>
						<div className="ztrans-font-medium">{__('Generate PO/MO', 'gemtranslate')}</div>
						<div className="ztrans-text-xs ztrans-text-ztrans-muted">
							{sprintf(
								/* translators: %s: file path. */
								__('Writes to wp-content/languages/plugins/%s-{locale}.mo', 'gemtranslate'),
								pkg.text_domain
							)}
						</div>
					</button>
					{pkg.wp_org_hosted && (
						<>
							<button
								type="button"
								onClick={() => { close(); onExport({ exclude_status: 'wp_org' }); }}
								className="ztrans-bare ztrans-block ztrans-w-full ztrans-border-t ztrans-border-ztrans-border ztrans-px-3 ztrans-py-2 ztrans-text-left ztrans-text-sm hover:ztrans-bg-gray-50"
							>
								<div className="ztrans-font-medium">{__('Export PO for WordPress.org', 'gemtranslate')}</div>
								<div className="ztrans-text-xs ztrans-text-ztrans-muted">
									{__('PO file with only your edits (skips community translations). Upload to translate.wordpress.org.', 'gemtranslate')}
								</div>
							</button>
							{wpOrgProjectUrl && (
								<a
									href={wpOrgProjectUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="ztrans-block ztrans-border-t ztrans-border-ztrans-border ztrans-px-3 ztrans-py-2 ztrans-text-sm ztrans-no-underline hover:ztrans-bg-gray-50"
								>
									<div className="ztrans-font-medium ztrans-text-ztrans-primary">
										{__('Contribute on translate.wordpress.org →', 'gemtranslate')}
									</div>
									<div className="ztrans-text-xs ztrans-text-ztrans-muted">
										{__('Opens the GlotPress project page in a new tab.', 'gemtranslate')}
									</div>
								</a>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

function truncate(s, n) {
	const str = String(s || '');
	return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

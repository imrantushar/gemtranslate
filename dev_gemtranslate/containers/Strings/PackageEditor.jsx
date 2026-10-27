import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
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
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{__('Package not found. It may have been uninstalled.', 'gemtranslate')}{' '}
						<Link to="/strings" className="gtrans-text-primary">
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
						className="gtrans-text-sm gtrans-text-primary gtrans-no-underline"
					>
						{__('← Back to plugins', 'gemtranslate')}
					</Link>
				}
			/>

			<Card padded={false}>
				{/* ---- Toolbar ---- */}
				<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-border-b gtrans-border-line gtrans-px-4 gtrans-py-3">
					<div className="gtrans-flex gtrans-items-center gtrans-gap-1 gtrans-text-xs">
						<span className="gtrans-mr-1 gtrans-text-muted">{__('Language:', 'gemtranslate')}</span>
						<select
							value={lang}
							onChange={(e) => navigate(`/strings/${slug}/${e.target.value}`)}
							className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-2 gtrans-py-1 gtrans-text-xs"
						>
							{targetLangs.map((l) => (
								<option key={l.code} value={l.code}>
									{l.name} ({l.code})
								</option>
							))}
						</select>
					</div>

					<div className="gtrans-flex gtrans-items-center gtrans-gap-1 gtrans-ml-2">
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
								className={`gtrans-bare gtrans-rounded-full gtrans-px-3 gtrans-py-1 gtrans-text-xs ${
									statusFilter === f.key
										? 'gtrans-bg-primary gtrans-text-white'
										: 'gtrans-bg-surface gtrans-border gtrans-border-line gtrans-text-label'
								}`}
							>
								{f.label}
							</button>
						))}
					</div>

					<form onSubmit={runSearch} className="gtrans-flex gtrans-items-center gtrans-gap-1">
						<TextInput
							value={searchDraft}
							onChange={(e) => setSearchDraft(e.target.value)}
							placeholder={__('Search…', 'gemtranslate')}
						/>
						<Button type="submit" variant="ghost" size="sm">{__('Filter', 'gemtranslate')}</Button>
					</form>

					<span className="gtrans-ml-auto gtrans-flex gtrans-items-center gtrans-gap-2">
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
					<p className="gtrans-px-5 gtrans-py-10 gtrans-text-center gtrans-text-sm gtrans-text-muted">
						{statusFilter === 'untranslated'
							? __('Nothing untranslated. Nice work.', 'gemtranslate')
							: __('No strings match.', 'gemtranslate')}
					</p>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader className="gtrans-w-1/2">{__('Source', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Translation', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader className="gtrans-w-24" />
							</Table.Row>
						</Table.Header>
						<Table.Body>
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
						</Table.Body>
					</Table.Root>
				)}

				{/* ---- Pagination ---- */}
				{total > PAGE_SIZE && (
					<div className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-border-t gtrans-border-line gtrans-px-4 gtrans-py-3 gtrans-text-sm">
						<span className="gtrans-text-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages, 3: total rows. */
								__('Page %1$d of %2$d · %3$d total', 'gemtranslate'),
								page,
								totalPages,
								total
							)}
						</span>
						<div className="gtrans-flex gtrans-gap-2">
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
		<Table.Row
			className={`gtrans-align-top ${dirty ? 'gtrans-bg-warning-light' : ''}`}
		>
			<Table.Cell>
				<div className="gtrans-text-ink">{row.source}</div>
				{row.file_ref && (
					<div className="gtrans-mt-1 gtrans-text-xs gtrans-text-muted">
						<code>{row.file_ref}</code>
					</div>
				)}
				{row.context && (
					<div className="gtrans-mt-1 gtrans-text-xs gtrans-text-muted">
						{__('Context', 'gemtranslate')}: <code>{row.context}</code>
					</div>
				)}
			</Table.Cell>
			<Table.Cell>
				<TextArea
					rows={Math.min(6, Math.max(2, Math.ceil((row.source?.length || 0) / 80)))}
					value={value}
					onChange={(e) => onChange(row.string_id, e.target.value)}
				/>
				<div className="gtrans-mt-1 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
					{fromWpOrg && (
						<span className="gtrans-rounded gtrans-bg-emerald-100 gtrans-px-1.5 gtrans-py-0.5 gtrans-text-emerald-800">
							🌐 {__('From translate.wordpress.org', 'gemtranslate')}
						</span>
					)}
					{status === 'translated' && !dirty && (
						<span className="gtrans-rounded gtrans-bg-blue-100 gtrans-px-1.5 gtrans-py-0.5 gtrans-text-blue-800">
							{__('Translated', 'gemtranslate')}
						</span>
					)}
					{status === 'draft' && (
						<span className="gtrans-rounded gtrans-bg-body gtrans-px-1.5 gtrans-py-0.5 gtrans-text-label">
							{__('Draft', 'gemtranslate')}
						</span>
					)}
					{dirty && (
						<span className="gtrans-rounded gtrans-bg-amber-100 gtrans-px-1.5 gtrans-py-0.5 gtrans-text-amber-800">
							{__('Unsaved', 'gemtranslate')}
						</span>
					)}
					{hasSuggestion && (
						<button
							type="button"
							onClick={() => onUseSuggestion(row.string_id, suggestion)}
							className="gtrans-bare gtrans-inline-flex gtrans-items-center gtrans-gap-1 gtrans-rounded gtrans-bg-indigo-50 gtrans-px-1.5 gtrans-py-0.5 gtrans-text-indigo-700 hover:gtrans-bg-indigo-100"
							title={suggestion}
						>
							💡 {__('Used elsewhere:', 'gemtranslate')}{' '}
							<span className="gtrans-italic">{truncate(suggestion, 40)}</span>
							<span className="gtrans-ml-1 gtrans-font-semibold">{__('Use', 'gemtranslate')}</span>
						</button>
					)}
					{wpOrgProjectUrl && status === 'translated' && !dirty && (
						<a
							href={`${wpOrgProjectUrl}?filters[term]=${encodeURIComponent(row.source)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="gtrans-text-[11px] gtrans-text-muted gtrans-no-underline hover:gtrans-text-primary"
						>
							{__('Suggest on WP.org →', 'gemtranslate')}
						</a>
					)}
				</div>
			</Table.Cell>
			<Table.Cell className="gtrans-text-right">
				<Button size="sm" variant="ghost" loading={aiBusy} onClick={() => onAi(row)}>
					{__('AI', 'gemtranslate')}
				</Button>
			</Table.Cell>
		</Table.Row>
	);
}

function ExportMenu({ onExport, loading, pkg, lang, wpOrgProjectUrl }) {
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);

	return (
		<div className="gtrans-relative">
			<Button size="sm" variant="ghost" loading={loading} onClick={() => setOpen((o) => !o)}>
				{__('Export ▾', 'gemtranslate')}
			</Button>
			{open && (
				<div
					className="gtrans-absolute gtrans-right-0 gtrans-z-10 gtrans-mt-1 gtrans-w-72 gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-shadow-card"
					onMouseLeave={close}
				>
					<button
						type="button"
						onClick={() => { close(); onExport({ exclude_status: '' }); }}
						className="gtrans-bare gtrans-block gtrans-w-full gtrans-px-3 gtrans-py-2 gtrans-text-left gtrans-text-sm hover:gtrans-bg-body"
					>
						<div className="gtrans-font-medium">{__('Generate PO/MO', 'gemtranslate')}</div>
						<div className="gtrans-text-xs gtrans-text-muted">
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
								className="gtrans-bare gtrans-block gtrans-w-full gtrans-border-t gtrans-border-line gtrans-px-3 gtrans-py-2 gtrans-text-left gtrans-text-sm hover:gtrans-bg-body"
							>
								<div className="gtrans-font-medium">{__('Export PO for WordPress.org', 'gemtranslate')}</div>
								<div className="gtrans-text-xs gtrans-text-muted">
									{__('PO file with only your edits (skips community translations). Upload to translate.wordpress.org.', 'gemtranslate')}
								</div>
							</button>
							{wpOrgProjectUrl && (
								<a
									href={wpOrgProjectUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="gtrans-block gtrans-border-t gtrans-border-line gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-no-underline hover:gtrans-bg-body"
								>
									<div className="gtrans-font-medium gtrans-text-primary">
										{__('Contribute on translate.wordpress.org →', 'gemtranslate')}
									</div>
									<div className="gtrans-text-xs gtrans-text-muted">
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

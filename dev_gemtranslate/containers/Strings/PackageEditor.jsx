import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import { Select } from '../../components/ui/Select';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';
import Toast from '../../components/Toast';
import TopbarActions from '../../components/TopbarActions';
import { TextArea, TextInput } from '../../components/Input';
import { PageSkeleton } from '../../components/Skeleton';
import { useStrings } from '../../hooks/useStrings';
import {
	useBulkSaveStrings,
	useExportPackage,
	usePackages,
	useScanPackage,
} from '../../hooks/usePackages';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

const PAGE_SIZE = 50;

// "C:\\...\\plugins\\foo\\includes\\a.php:12" -> "includes/a.php:12"
const shortRef = (ref) => {
	const norm = String(ref || '').replace(/\\/g, '/');
	const m = norm.match(/(?:plugins|themes)\/[^/]+\/(.*)$/);
	return m ? m[1] : norm;
};

export default function PackageEditor() {
	const { slug, lang } = useParams();
	const navigate = useNavigate();
	const packages = usePackages();
	const languages = useLanguages();
	const scan = useScanPackage();
	const bulkSave = useBulkSaveStrings();
	const exportPack = useExportPackage();

	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all'); // all | untranslated | translated
	const [drafts, setDrafts] = useState({}); // string_id -> {value, dirty}
	const [toast, setToast] = useState(null);

	const pkg = (packages.data?.rows || []).find((p) => p.slug === slug) || null;
	const targetLangs = (languages.data || []).filter((l) => !l.is_default);
	const langRow = (languages.data || []).find((l) => l.code === lang);

	const apiStatus = statusFilter === 'all' ? '' : statusFilter;
	const strings = useStrings({
		domain: pkg?.text_domain || '',
		lang,
		page,
		per_page: PAGE_SIZE,
		search,
		status: apiStatus,
	});

	// On data load, pre-populate drafts from existing translations so editing
	// reflects the current saved value.
	useEffect(() => {
		if (!strings.data) return;
		setDrafts((d) => {
			const next = { ...d };
			(strings.data.rows || []).forEach((row) => {
				if (next[row.string_id]) return; // preserve dirty edits across page changes
				next[row.string_id] = {
					value: row.translation || '',
					original: row.translation || '',
					dirty: false,
					status: row.translation_status || '',
				};
			});
			return next;
		});
	}, [strings.data]);

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

	useEffect(() => {
		window.scrollTo({ top: 0 });
	}, [page]);

	if (packages.isLoading || strings.isLoading || languages.isLoading) {
		return <PageSkeleton />;
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
			[id]: { ...(d[id] || {}), value, dirty: value !== (d[id]?.original ?? '') },
		}));
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
					if (next[t.string_id]) {
						next[t.string_id] = { ...next[t.string_id], original: t.value, dirty: false, status: 'translated' };
					}
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

	saveRef.current = onSaveAll;

	const onDiscard = () => {
		setDrafts((d) => {
			const next = {};
			Object.entries(d).forEach(([id, v]) => {
				next[id] = v.dirty ? { ...v, value: v.original ?? '', dirty: false } : v;
			});
			return next;
		});
	};

	const progressPct = stats.total ? Math.round((doneCount / stats.total) * 100) : 0;

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
					<span className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
						<code>{pkg.text_domain}</code>
						<span className="gtrans-flex gtrans-items-center gtrans-gap-2">
							<span
								className="gtrans-block gtrans-h-1.5 gtrans-w-40 gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-body"
								role="progressbar"
								aria-valuenow={progressPct}
								aria-valuemin={0}
								aria-valuemax={100}
							>
								<span className="gtrans-block gtrans-h-full gtrans-bg-primary" style={{ width: progressPct + '%' }} />
							</span>
							{sprintf(
								/* translators: 1: done count, 2: total, 3: percent. */
								__('%1$d / %2$d translated (%3$d%%)', 'gemtranslate'),
								doneCount,
								stats.total || 0,
								progressPct
							)}
						</span>
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

			<TopbarActions>
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
					title={__('Ctrl/Cmd + S', 'gemtranslate')}
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
			</TopbarActions>

			<Card table>
				{/* ---- Toolbar ---- */}
				<div className="gtrans-sticky-toolbar gtrans--mx-6 gtrans--mt-6 gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-x-4 gtrans-gap-y-2 gtrans-border-b gtrans-border-line gtrans-px-6 gtrans-py-2">
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-x-4 gtrans-gap-y-1">
						<div className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-xs">
							<span className="gtrans-text-muted">{__('Language:', 'gemtranslate')}</span>
							<Select
								className="gtrans-min-w-[180px]"
								value={lang}
								onChange={(e) => navigate(`/strings/${slug}/${e.target.value}`)}
							>
								{targetLangs.map((l) => (
									<option key={l.code} value={l.code}>
										{l.name} ({l.code})
									</option>
								))}
							</Select>
						</div>

						<StatusTabs
							value={statusFilter}
							onChange={(key) => {
								setStatusFilter(key);
								setPage(1);
							}}
							tabs={[
								{ value: 'all', label: __('All', 'gemtranslate') },
								{ value: 'untranslated', label: __('Untranslated', 'gemtranslate') },
								{ value: 'translated', label: __('Translated', 'gemtranslate') },
							]}
						/>
					</div>

					<div className="gtrans-ml-auto gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-end gtrans-gap-2">
						<SearchBox
							className="gtrans-w-52"
							value={search}
							placeholder={__('Search…', 'gemtranslate')}
							onSearch={(keyword) => {
								setPage(1);
								setSearch(keyword);
							}}
						/>
					</div>
				</div>

				{/* ---- Rows ---- */}
				{rows.length === 0 ? (
					<Table.Empty columns={[__('Source', 'gemtranslate'), __('Translation', 'gemtranslate')]}>
						{statusFilter === 'untranslated'
							? __('Nothing untranslated. Nice work.', 'gemtranslate')
							: __('No strings match.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader className="gtrans-w-1/2">{__('Source', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Translation', 'gemtranslate')}</Table.ColumnHeader>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((row) => (
								<StringRow
									key={row.string_id}
									row={row}
									draft={drafts[row.string_id]}
									wpOrgProjectUrl={wpOrgProjectUrl}
									onChange={onChange}
								/>
							))}
						</Table.Body>
					</Table.Root>
				)}

				{/* ---- Pagination ---- */}
				{total > PAGE_SIZE && (
					<div className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-mt-3 gtrans-text-sm">
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

			{dirtyCount > 0 && (
				<div className="gtrans-sticky gtrans-bottom-4 gtrans-z-30 gtrans-mt-4 gtrans-flex gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-px-4 gtrans-py-3 gtrans-shadow-gtrans">
					<span className="gtrans-text-sm gtrans-text-ink">
						{sprintf(
							/* translators: %d: number of unsaved translations. */
							_n('%d unsaved change', '%d unsaved changes', dirtyCount, 'gemtranslate'),
							dirtyCount
						)}
					</span>
					<span className="gtrans-flex gtrans-items-center gtrans-gap-2">
						<Button size="sm" variant="ghost" onClick={onDiscard}>
							{__('Discard', 'gemtranslate')}
						</Button>
						<Button size="sm" loading={bulkSave.isPending} onClick={onSaveAll}>
							{__('Save all', 'gemtranslate')}
						</Button>
					</span>
				</div>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

function StringRow({ row, draft, wpOrgProjectUrl, onChange }) {
	const value = draft?.value ?? row.translation ?? '';
	const dirty = draft?.dirty;
	const status = draft?.status || row.translation_status || '';
	const fromWpOrg = status === 'wp_org';
	const empty = value.trim() === '';

	return (
		<Table.Row className={`gtrans-align-top ${dirty ? 'gtrans-bg-warning-light' : ''}`}>
			<Table.Cell className="gtrans-w-1/2 gtrans-align-top">
				<div className="gtrans-whitespace-pre-wrap gtrans-break-words gtrans-text-sm gtrans-leading-relaxed gtrans-text-ink">
					{row.source}
				</div>
				{(row.file_ref || row.context) && (
					<div className="gtrans-mt-1.5 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-x-3 gtrans-gap-y-1 gtrans-text-11 gtrans-text-muted">
						{row.file_ref && (
							<span title={row.file_ref} className="gtrans-font-mono">
								{shortRef(row.file_ref)}
							</span>
						)}
						{row.context && (
							<span>
								{__('Context', 'gemtranslate')}: <code>{row.context}</code>
							</span>
						)}
					</div>
				)}
			</Table.Cell>
			<Table.Cell className="gtrans-align-top">
				<TextArea
					rows={Math.min(6, Math.max(1, Math.ceil((row.source?.length || 0) / 60)))}
					value={value}
					placeholder={empty ? __('Type the translation…', 'gemtranslate') : ''}
					onChange={(e) => onChange(row.string_id, e.target.value)}
				/>
				<div className="gtrans-mt-1 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
					{empty && (
						<button
							type="button"
							onClick={() => onChange(row.string_id, row.source || '')}
							className="gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-text-11 gtrans-text-primary hover:gtrans-underline"
						>
							{__('Copy source', 'gemtranslate')}
						</button>
					)}
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
					{wpOrgProjectUrl && status === 'translated' && !dirty && (
						<a
							href={`${wpOrgProjectUrl}?filters[term]=${encodeURIComponent(row.source)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="gtrans-text-11 gtrans-text-muted gtrans-no-underline hover:gtrans-text-primary"
						>
							{__('Suggest on WP.org →', 'gemtranslate')}
						</a>
					)}
				</div>
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';
import Toast from '../../components/Toast';
import { TextInput } from '../../components/Input';
import { PageSkeleton } from '../../components/Skeleton';
import { usePackages, useScanPackage, useAuditPackage } from '../../hooks/usePackages';
import AuditModal, { auditIssueCount } from './AuditModal';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

/**
 * Loco-style landing page. One row per installed plugin/theme with a
 * translation-progress strip per active language. Click a row to drill into
 * its dedicated editor.
 */
export default function PackageList() {
	const packages = usePackages();
	const languages = useLanguages();
	const scan = useScanPackage();
	const [filter, setFilter] = useState('');
	const [typeFilter, setTypeFilter] = useState('all'); // all | plugin | theme
	const [toast, setToast] = useState(null);
	const [scanningSlug, setScanningSlug] = useState('');
	const audit = useAuditPackage();
	const [auditingSlug, setAuditingSlug] = useState('');
	const [auditProgress, setAuditProgress] = useState(null);
	const [auditView, setAuditView] = useState(null); // package whose findings are open

	if (packages.isLoading) return <PageSkeleton />;
	if (packages.error) return <p className="gtrans-text-red-600">{formatErrorMessage(packages.error)}</p>;

	const langCodes = packages.data?.meta?.languages || [];
	const langByCode = Object.fromEntries((languages.data || []).map((l) => [l.code, l]));
	const defaultLang = (languages.data || []).find((l) => l.is_default);
	const firstTargetLang = langCodes[0];

	const rows = (packages.data?.rows || []).filter((r) => {
		if (typeFilter !== 'all' && r.type !== typeFilter) return false;
		if (!filter) return true;
		const q = filter.toLowerCase();
		return (
			r.name.toLowerCase().includes(q) ||
			r.text_domain.toLowerCase().includes(q) ||
			r.slug.toLowerCase().includes(q)
		);
	});

	const onScan = async (row) => {
		setScanningSlug(row.slug);
		try {
			const result = await scan.mutateAsync({ slug: row.slug });
			const wpOrg = result?.wporg?.imported || 0;
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: plugin name, 2: string count, 3: WP.org imported count. */
					__('Scanned %1$s — found %2$d strings, imported %3$d community translations.', 'gemtranslate'),
					row.name,
					result?.string_count ?? 0,
					wpOrg
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setScanningSlug('');
		}
	};

	const onAudit = async (row, { openAfter = true } = {}) => {
		setAuditingSlug(row.slug);
		setAuditProgress(null);
		try {
			const result = await audit.mutateAsync({
				slug: row.slug,
				onProgress: (done, total) => setAuditProgress({ done, total }),
			});
			if (openAfter) setAuditView(row);
			const issues = auditIssueCount(result?.counts);
			setToast({
				tone: issues ? 'info' : 'success',
				message: issues
					? sprintf(
							/* translators: 1: plugin name, 2: issue count. */
							__('Audited %1$s — %2$d translation issues found.', 'gemtranslate'),
							row.name,
							issues
						)
					: sprintf(
							/* translators: %s: plugin name. */
							__('Audited %s — no translation issues found.', 'gemtranslate'),
							row.name
						),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setAuditingSlug('');
			setAuditProgress(null);
		}
	};

	if (langCodes.length === 0) {
		return (
			<>
				<PageHeader
					title={__('Strings', 'gemtranslate')}
					description={__('Translate strings from installed plugins and themes.', 'gemtranslate')}
				/>
				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{__('Add at least one non-default language to start translating plugins.', 'gemtranslate')}
					</p>
				</Card>
			</>
		);
	}

	return (
		<>
			<PageHeader
				title={__('Strings', 'gemtranslate')}
				description={__('Pick a plugin or theme to translate. Each one is scanned on demand and tracks its own progress.', 'gemtranslate')}
				actions={
					<Link
						to="/strings/legacy"
						className="gtrans-text-xs gtrans-text-muted gtrans-no-underline hover:gtrans-text-label"
					>
						{__('Advanced (flat view) →', 'gemtranslate')}
					</Link>
				}
			/>

			<Card table>
				<Table.Toolbar variant="tabs">
					<StatusTabs
						value={typeFilter}
						onChange={setTypeFilter}
						tabs={[
							{ value: 'all', label: __('All', 'gemtranslate'), count: packages.data?.rows?.length || 0 },
							{ value: 'plugin', label: __('Plugins', 'gemtranslate') },
							{ value: 'theme', label: __('Themes', 'gemtranslate') },
						]}
					/>
					<SearchBox
						value={filter}
						placeholder={__('Search plugins & themes…', 'gemtranslate')}
						onSearch={setFilter}
					/>
				</Table.Toolbar>

				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.ColumnHeader>{__('Plugin / Theme', 'gemtranslate')}</Table.ColumnHeader>
							<Table.ColumnHeader className="gtrans-w-32">{__('Text domain', 'gemtranslate')}</Table.ColumnHeader>
							<Table.ColumnHeader className="gtrans-w-24">{__('Strings', 'gemtranslate')}</Table.ColumnHeader>
							<Table.ColumnHeader>{__('Translation progress', 'gemtranslate')}</Table.ColumnHeader>
							<Table.ColumnHeader className="gtrans-w-56" />
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map((row) => (
							<PackageRow
								key={`${row.type}-${row.slug}`}
								row={row}
								langCodes={langCodes}
								langByCode={langByCode}
								firstTargetLang={firstTargetLang}
								onScan={onScan}
								scanning={scanningSlug === row.slug}
								defaultLang={defaultLang}
								onAudit={onAudit}
								onViewAudit={setAuditView}
								auditing={auditingSlug === row.slug}
								auditProgress={auditingSlug === row.slug ? auditProgress : null}
							/>
						))}
						{rows.length === 0 && (
							<Table.Row>
								<Table.Cell colSpan={5}>
									<Table.Empty>{__('No matches.', 'gemtranslate')}</Table.Empty>
								</Table.Cell>
							</Table.Row>
						)}
					</Table.Body>
				</Table.Root>
			</Card>

			{auditView && (
				<AuditModal
					pkg={auditView}
					onClose={() => setAuditView(null)}
					onRerun={() => onAudit(auditView, { openAfter: false })}
					running={auditingSlug === auditView.slug}
					progress={auditingSlug === auditView.slug ? auditProgress : null}
				/>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

/**
 * Per-row audit control: "Audit" until it has been run once, then a badge with
 * the issue count that opens the findings.
 */
function AuditButton({ row, onAudit, onViewAudit, auditing, progress }) {
	const issues = auditIssueCount(row.audit);

	if (auditing) {
		return (
			<Button size="sm" variant="secondary" loading disabled>
				{progress ? `${progress.done}/${progress.total}` : __('Audit', 'gemtranslate')}
			</Button>
		);
	}
	if (!row.audit) {
		return (
			<Button
				size="sm"
				variant="secondary"
				onClick={() => onAudit(row)}
				title={__('Check for missing text domains and hardcoded text', 'gemtranslate')}
			>
				{__('Audit', 'gemtranslate')}
			</Button>
		);
	}
	return (
		<button
			type="button"
			onClick={() => onViewAudit(row)}
			title={__('View translation-readiness findings', 'gemtranslate')}
			className={`gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-px-2.5 gtrans-py-1.5 gtrans-text-xs gtrans-font-medium ${
				issues
					? 'gtrans-border-amber-300 gtrans-bg-amber-50 gtrans-text-amber-800'
					: 'gtrans-border-emerald-300 gtrans-bg-emerald-50 gtrans-text-emerald-800'
			}`}
		>
			{issues
				? sprintf(
						/* translators: %d: number of translation issues. */
						_n('%d issue', '%d issues', issues, 'gemtranslate'),
						issues
					)
				: __('✓ Clean', 'gemtranslate')}
		</button>
	);
}

function PackageRow({
	row,
	langCodes,
	langByCode,
	firstTargetLang,
	onScan,
	scanning,
	defaultLang,
	onAudit,
	onViewAudit,
	auditing,
	auditProgress,
}) {
	const hasStrings = row.string_count > 0;
	return (
		<Table.Row className="gtrans-align-top">
			<Table.Cell>
				<div className="gtrans-flex gtrans-items-center gtrans-gap-2">
					<span
						className={`gtrans-rounded gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[10px] gtrans-font-semibold gtrans-uppercase ${
							row.type === 'theme'
								? 'gtrans-bg-purple-100 gtrans-text-purple-800'
								: 'gtrans-bg-indigo-100 gtrans-text-indigo-800'
						}`}
					>
						{row.type === 'theme' ? __('theme', 'gemtranslate') : __('plugin', 'gemtranslate')}
					</span>
					<span className="gtrans-font-medium gtrans-text-ink">{row.name}</span>
					{row.wp_org_hosted && (
						<span
							title={__('Hosted on wordpress.org/plugins/', 'gemtranslate')}
							className="gtrans-text-[10px] gtrans-text-emerald-700"
						>
							🌐 WP.org
						</span>
					)}
				</div>
				<div className="gtrans-mt-0.5 gtrans-text-xs gtrans-text-muted">
					v{row.version}
				</div>
			</Table.Cell>
			<Table.Cell className="gtrans-text-xs gtrans-text-muted">
				<code>{row.text_domain}</code>
			</Table.Cell>
			<Table.Cell className="gtrans-text-xs">
				{hasStrings ? (
					<span>{row.string_count}</span>
				) : (
					<span className="gtrans-text-muted">{__('Not scanned', 'gemtranslate')}</span>
				)}
			</Table.Cell>
			<Table.Cell>
				{hasStrings ? (
					<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-2">
						{langCodes.map((code) => {
							const stats = row.per_lang?.[code] || { total: 0, translated: 0, wp_org: 0, draft: 0, missing: 0 };
							const done = stats.translated + stats.wp_org + stats.draft;
							const total = stats.total || row.string_count;
							const pct = total > 0 ? Math.round((done / total) * 100) : 0;
							return (
								<Link
									key={code}
									to={`/strings/${row.slug}/${code}`}
									className="gtrans-inline-flex gtrans-items-center gtrans-gap-1.5 gtrans-rounded-full gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-2.5 gtrans-py-1 gtrans-text-xs gtrans-text-label gtrans-no-underline hover:gtrans-bg-body"
									title={sprintf(
										/* translators: 1: language name, 2: translated, 3: wp_org, 4: total. */
										__('%1$s — %2$d translated, %3$d from WP.org, %4$d total', 'gemtranslate'),
										langByCode[code]?.name || code,
										stats.translated,
										stats.wp_org,
										total
									)}
								>
									<span className="gtrans-font-medium">{code}</span>
									<span className="gtrans-text-[10px] gtrans-text-muted">{pct}%</span>
									<span
										className="gtrans-h-1.5 gtrans-w-12 gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-line"
										aria-hidden="true"
									>
										<span
											className="gtrans-block gtrans-h-full gtrans-bg-emerald-500"
											style={{ width: `${pct}%` }}
										/>
									</span>
								</Link>
							);
						})}
					</div>
				) : (
					<span className="gtrans-text-xs gtrans-text-muted">
						{__('Click Scan to discover strings.', 'gemtranslate')}
					</span>
				)}
			</Table.Cell>
			<Table.Cell className="gtrans-text-right">
				<div className="gtrans-flex gtrans-items-center gtrans-justify-end gtrans-gap-2">
					<AuditButton
						row={row}
						onAudit={onAudit}
						onViewAudit={onViewAudit}
						auditing={auditing}
						progress={auditProgress}
					/>
					{hasStrings ? (
						<Link
							to={`/strings/${row.slug}/${firstTargetLang}`}
							className="gtrans-inline-flex gtrans-items-center gtrans-rounded-md gtrans-bg-primary gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-font-medium gtrans-text-white gtrans-no-underline hover:gtrans-bg-primary-hover"
						>
							{__('Open', 'gemtranslate')}
						</Link>
					) : (
						<Button size="sm" variant="secondary" loading={scanning} onClick={() => onScan(row)}>
							{__('Scan', 'gemtranslate')}
						</Button>
					)}
				</div>
			</Table.Cell>
		</Table.Row>
	);
}

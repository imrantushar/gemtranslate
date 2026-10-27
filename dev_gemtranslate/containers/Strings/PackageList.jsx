import { useState } from 'react';
import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { usePackages, useScanPackage } from '../../hooks/usePackages';
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

	if (packages.isLoading) return <LoadingBlock>{__('Loading plugins & themes…', 'gemtranslate')}</LoadingBlock>;
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

	if (langCodes.length === 0) {
		return (
			<>
				<PageHeader
					title={__('Strings', 'gemtranslate')}
					description={__('Translate strings from installed plugins and themes.', 'gemtranslate')}
				/>
				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-gtrans-muted">
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
						className="gtrans-text-xs gtrans-text-gtrans-muted gtrans-no-underline hover:gtrans-text-gray-700"
					>
						{__('Advanced (flat view) →', 'gemtranslate')}
					</Link>
				}
			/>

			<Card padded={false}>
				<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3 gtrans-border-b gtrans-border-gtrans-border gtrans-px-4 gtrans-py-3">
					<div className="gtrans-flex gtrans-items-center gtrans-gap-1 gtrans-text-xs">
						{['all', 'plugin', 'theme'].map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTypeFilter(t)}
								className={`gtrans-bare gtrans-rounded-full gtrans-px-3 gtrans-py-1 ${
									typeFilter === t
										? 'gtrans-bg-gtrans-primary gtrans-text-white'
										: 'gtrans-bg-white gtrans-border gtrans-border-gtrans-border gtrans-text-gray-700'
								}`}
							>
								{t === 'all'
									? __('All', 'gemtranslate')
									: t === 'plugin'
										? __('Plugins', 'gemtranslate')
										: __('Themes', 'gemtranslate')}
							</button>
						))}
					</div>
					<div className="gtrans-flex-1 gtrans-min-w-[200px]">
						<TextInput
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder={__('Search plugins & themes…', 'gemtranslate')}
						/>
					</div>
					<span className="gtrans-text-xs gtrans-text-gtrans-muted">
						{sprintf(
							/* translators: %d: count. */
							__('%d installed', 'gemtranslate'),
							packages.data?.rows?.length || 0
						)}
					</span>
				</div>

				<table className="gtrans-w-full gtrans-text-sm">
					<thead className="gtrans-bg-gtrans-bg gtrans-text-left gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
						<tr>
							<th className="gtrans-px-4 gtrans-py-3">{__('Plugin / Theme', 'gemtranslate')}</th>
							<th className="gtrans-px-4 gtrans-py-3 gtrans-w-32">{__('Text domain', 'gemtranslate')}</th>
							<th className="gtrans-px-4 gtrans-py-3 gtrans-w-24">{__('Strings', 'gemtranslate')}</th>
							<th className="gtrans-px-4 gtrans-py-3">{__('Translation progress', 'gemtranslate')}</th>
							<th className="gtrans-px-4 gtrans-py-3 gtrans-w-32" />
						</tr>
					</thead>
					<tbody>
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
							/>
						))}
						{rows.length === 0 && (
							<tr>
								<td colSpan={5} className="gtrans-px-4 gtrans-py-8 gtrans-text-center gtrans-text-sm gtrans-text-gtrans-muted">
									{__('No matches.', 'gemtranslate')}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

function PackageRow({ row, langCodes, langByCode, firstTargetLang, onScan, scanning, defaultLang }) {
	const hasStrings = row.string_count > 0;
	return (
		<tr className="gtrans-border-t gtrans-border-gtrans-border gtrans-align-top">
			<td className="gtrans-px-4 gtrans-py-3">
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
					<span className="gtrans-font-medium gtrans-text-gray-900">{row.name}</span>
					{row.wp_org_hosted && (
						<span
							title={__('Hosted on wordpress.org/plugins/', 'gemtranslate')}
							className="gtrans-text-[10px] gtrans-text-emerald-700"
						>
							🌐 WP.org
						</span>
					)}
				</div>
				<div className="gtrans-mt-0.5 gtrans-text-xs gtrans-text-gtrans-muted">
					v{row.version}
				</div>
			</td>
			<td className="gtrans-px-4 gtrans-py-3 gtrans-text-xs gtrans-text-gtrans-muted">
				<code>{row.text_domain}</code>
			</td>
			<td className="gtrans-px-4 gtrans-py-3 gtrans-text-xs">
				{hasStrings ? (
					<span>{row.string_count}</span>
				) : (
					<span className="gtrans-text-gtrans-muted">{__('Not scanned', 'gemtranslate')}</span>
				)}
			</td>
			<td className="gtrans-px-4 gtrans-py-3">
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
									className="gtrans-inline-flex gtrans-items-center gtrans-gap-1.5 gtrans-rounded-full gtrans-border gtrans-border-gtrans-border gtrans-bg-white gtrans-px-2.5 gtrans-py-1 gtrans-text-xs gtrans-text-gray-700 gtrans-no-underline hover:gtrans-bg-gray-50"
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
									<span className="gtrans-text-[10px] gtrans-text-gtrans-muted">{pct}%</span>
									<span
										className="gtrans-h-1.5 gtrans-w-12 gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-gray-200"
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
					<span className="gtrans-text-xs gtrans-text-gtrans-muted">
						{__('Click Scan to discover strings.', 'gemtranslate')}
					</span>
				)}
			</td>
			<td className="gtrans-px-4 gtrans-py-3 gtrans-text-right">
				{hasStrings ? (
					<Link
						to={`/strings/${row.slug}/${firstTargetLang}`}
						className="gtrans-inline-flex gtrans-items-center gtrans-rounded-md gtrans-bg-gtrans-primary gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-font-medium gtrans-text-white gtrans-no-underline hover:gtrans-bg-gtrans-primary-hover"
					>
						{__('Open', 'gemtranslate')}
					</Link>
				) : (
					<Button size="sm" variant="secondary" loading={scanning} onClick={() => onScan(row)}>
						{__('Scan', 'gemtranslate')}
					</Button>
				)}
			</td>
		</tr>
	);
}

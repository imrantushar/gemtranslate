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
	if (packages.error) return <p className="ztrans-text-red-600">{formatErrorMessage(packages.error)}</p>;

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
					<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
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
						className="ztrans-text-xs ztrans-text-ztrans-muted ztrans-no-underline hover:ztrans-text-gray-700"
					>
						{__('Advanced (flat view) →', 'gemtranslate')}
					</Link>
				}
			/>

			<Card padded={false}>
				<div className="ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3">
					<div className="ztrans-flex ztrans-items-center ztrans-gap-1 ztrans-text-xs">
						{['all', 'plugin', 'theme'].map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTypeFilter(t)}
								className={`ztrans-bare ztrans-rounded-full ztrans-px-3 ztrans-py-1 ${
									typeFilter === t
										? 'ztrans-bg-ztrans-primary ztrans-text-white'
										: 'ztrans-bg-white ztrans-border ztrans-border-ztrans-border ztrans-text-gray-700'
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
					<div className="ztrans-flex-1 ztrans-min-w-[200px]">
						<TextInput
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder={__('Search plugins & themes…', 'gemtranslate')}
						/>
					</div>
					<span className="ztrans-text-xs ztrans-text-ztrans-muted">
						{sprintf(
							/* translators: %d: count. */
							__('%d installed', 'gemtranslate'),
							packages.data?.rows?.length || 0
						)}
					</span>
				</div>

				<table className="ztrans-w-full ztrans-text-sm">
					<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
						<tr>
							<th className="ztrans-px-4 ztrans-py-3">{__('Plugin / Theme', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3 ztrans-w-32">{__('Text domain', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3 ztrans-w-24">{__('Strings', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3">{__('Translation progress', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3 ztrans-w-32" />
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
								<td colSpan={5} className="ztrans-px-4 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
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
		<tr className="ztrans-border-t ztrans-border-ztrans-border ztrans-align-top">
			<td className="ztrans-px-4 ztrans-py-3">
				<div className="ztrans-flex ztrans-items-center ztrans-gap-2">
					<span
						className={`ztrans-rounded ztrans-px-1.5 ztrans-py-0.5 ztrans-text-[10px] ztrans-font-semibold ztrans-uppercase ${
							row.type === 'theme'
								? 'ztrans-bg-purple-100 ztrans-text-purple-800'
								: 'ztrans-bg-indigo-100 ztrans-text-indigo-800'
						}`}
					>
						{row.type === 'theme' ? __('theme', 'gemtranslate') : __('plugin', 'gemtranslate')}
					</span>
					<span className="ztrans-font-medium ztrans-text-gray-900">{row.name}</span>
					{row.wp_org_hosted && (
						<span
							title={__('Hosted on wordpress.org/plugins/', 'gemtranslate')}
							className="ztrans-text-[10px] ztrans-text-emerald-700"
						>
							🌐 WP.org
						</span>
					)}
				</div>
				<div className="ztrans-mt-0.5 ztrans-text-xs ztrans-text-ztrans-muted">
					v{row.version}
				</div>
			</td>
			<td className="ztrans-px-4 ztrans-py-3 ztrans-text-xs ztrans-text-ztrans-muted">
				<code>{row.text_domain}</code>
			</td>
			<td className="ztrans-px-4 ztrans-py-3 ztrans-text-xs">
				{hasStrings ? (
					<span>{row.string_count}</span>
				) : (
					<span className="ztrans-text-ztrans-muted">{__('Not scanned', 'gemtranslate')}</span>
				)}
			</td>
			<td className="ztrans-px-4 ztrans-py-3">
				{hasStrings ? (
					<div className="ztrans-flex ztrans-flex-wrap ztrans-gap-2">
						{langCodes.map((code) => {
							const stats = row.per_lang?.[code] || { total: 0, translated: 0, wp_org: 0, draft: 0, missing: 0 };
							const done = stats.translated + stats.wp_org + stats.draft;
							const total = stats.total || row.string_count;
							const pct = total > 0 ? Math.round((done / total) * 100) : 0;
							return (
								<Link
									key={code}
									to={`/strings/${row.slug}/${code}`}
									className="ztrans-inline-flex ztrans-items-center ztrans-gap-1.5 ztrans-rounded-full ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-px-2.5 ztrans-py-1 ztrans-text-xs ztrans-text-gray-700 ztrans-no-underline hover:ztrans-bg-gray-50"
									title={sprintf(
										/* translators: 1: language name, 2: translated, 3: wp_org, 4: total. */
										__('%1$s — %2$d translated, %3$d from WP.org, %4$d total', 'gemtranslate'),
										langByCode[code]?.name || code,
										stats.translated,
										stats.wp_org,
										total
									)}
								>
									<span className="ztrans-font-medium">{code}</span>
									<span className="ztrans-text-[10px] ztrans-text-ztrans-muted">{pct}%</span>
									<span
										className="ztrans-h-1.5 ztrans-w-12 ztrans-overflow-hidden ztrans-rounded-full ztrans-bg-gray-200"
										aria-hidden="true"
									>
										<span
											className="ztrans-block ztrans-h-full ztrans-bg-emerald-500"
											style={{ width: `${pct}%` }}
										/>
									</span>
								</Link>
							);
						})}
					</div>
				) : (
					<span className="ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Click Scan to discover strings.', 'gemtranslate')}
					</span>
				)}
			</td>
			<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
				{hasStrings ? (
					<Link
						to={`/strings/${row.slug}/${firstTargetLang}`}
						className="ztrans-inline-flex ztrans-items-center ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-3 ztrans-py-1.5 ztrans-text-xs ztrans-font-medium ztrans-text-white ztrans-no-underline hover:ztrans-bg-ztrans-primary-hover"
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

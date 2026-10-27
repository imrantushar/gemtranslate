import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
import { Field, Select, TextInput, TextArea } from '../../components/Input';
import { useScanStrings, useSaveStringTranslation, useStringDomains, useStrings } from '../../hooks/useStrings';
import { useLanguages } from '../../hooks/useLanguages';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage, truncate } from '../../lib/format';

export default function StringsLegacy() {
	const languages = useLanguages();
	const langs = languages.data || [];
	const nonDefault = langs.filter((l) => !l.is_default);
	const defaultLang = langs.find((l) => l.is_default);

	const [filters, setFilters] = useState({
		page: 1,
		per_page: 50,
		search: '',
		domain: '',
		lang: nonDefault[0]?.code || '',
	});
	const [search, setSearch] = useState('');
	const strings = useStrings(filters);
	const domains = useStringDomains();
	const save = useSaveStringTranslation();
	const scan = useScanStrings();
	const ai = useTranslateWithAI();
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);

	if (filters.lang === '' && nonDefault[0]) {
		setFilters((f) => ({ ...f, lang: nonDefault[0].code }));
	}

	const runSearch = (e) => {
		e.preventDefault();
		setFilters((f) => ({ ...f, search, page: 1 }));
	};

	const onSave = async (id) => {
		const value = drafts[id] ?? '';
		try {
			await save.mutateAsync({ id, lang: filters.lang, value, status: 'translated' });
			setToast({ tone: 'success', message: __('Translation saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onAI = async (row) => {
		try {
			const res = await ai.mutateAsync({
				text: row.source,
				source_lang: defaultLang?.code || 'en',
				target_lang: filters.lang,
				preserve_html: false,
				use_memory: true,
			});
			setDrafts((d) => ({ ...d, [row.string_id]: res.translations }));
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onScan = async (target) => {
		try {
			const result = await scan.mutateAsync({ target });
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: file count, 2: string count. */
					__('Scanned %1$d files, found %2$d strings.', 'gemtranslate'),
					result.files,
					result.strings
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Strings', 'gemtranslate')}
				description={__('Translate hardcoded UI strings from your active theme and plugins.', 'gemtranslate')}
				actions={
					<>
						<Button variant="secondary" onClick={() => onScan('active_theme')} loading={scan.isPending}>
							{__('Scan active theme', 'gemtranslate')}
						</Button>
						<Button onClick={() => onScan('all_plugins')} loading={scan.isPending}>
							{__('Scan all plugins', 'gemtranslate')}
						</Button>
					</>
				}
			/>

			<Card padded={false}>
				<form onSubmit={runSearch} className="ztrans-flex ztrans-flex-wrap ztrans-items-end ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3">
					<div className="ztrans-min-w-[160px]">
						<Field label={__('Target language', 'gemtranslate')}>
							<Select value={filters.lang} onChange={(e) => setFilters((f) => ({ ...f, lang: e.target.value, page: 1 }))}>
								{nonDefault.map((l) => (
									<option key={l.code} value={l.code}>
										{l.name} ({l.code})
									</option>
								))}
							</Select>
						</Field>
					</div>
					<div className="ztrans-min-w-[160px]">
						<Field label={__('Domain', 'gemtranslate')}>
							<Select value={filters.domain} onChange={(e) => setFilters((f) => ({ ...f, domain: e.target.value, page: 1 }))}>
								<option value="">{__('All domains', 'gemtranslate')}</option>
								{(domains.data || []).map((d) => (
									<option key={d} value={d}>
										{d || __('(empty)', 'gemtranslate')}
									</option>
								))}
							</Select>
						</Field>
					</div>
					<div className="ztrans-min-w-[200px] ztrans-flex-1">
						<Field label={__('Search source', 'gemtranslate')}>
							<TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={__('Search…', 'gemtranslate')} />
						</Field>
					</div>
					<Button type="submit" variant="secondary">{__('Filter', 'gemtranslate')}</Button>
				</form>

				{strings.isLoading ? (
					<LoadingBlock>{__('Loading strings…', 'gemtranslate')}</LoadingBlock>
				) : (strings.data?.rows || []).length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No strings yet. Scan a theme or plugin to populate this list.', 'gemtranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-1/3">{__('Source', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">
									{sprintf(
										/* translators: %s: language code. */
										__('Translation (%s)', 'gemtranslate'),
										filters.lang
									)}
								</th>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-32">{__('Domain', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-32" />
							</tr>
						</thead>
						<tbody>
							{(strings.data?.rows || []).map((row) => {
								const draft = drafts[row.string_id] ?? row.translation ?? '';
								return (
									<tr key={row.string_id} className="ztrans-border-t ztrans-border-ztrans-border ztrans-align-top">
										<td className="ztrans-px-4 ztrans-py-3">
											<div className="ztrans-text-gray-900">{truncate(row.source, 240)}</div>
											{row.file_ref && (
												<div className="ztrans-mt-1 ztrans-text-xs ztrans-text-ztrans-muted"><code>{row.file_ref}</code></div>
											)}
										</td>
										<td className="ztrans-px-4 ztrans-py-3">
											<TextArea
												rows={Math.min(6, Math.max(2, Math.ceil(row.source.length / 80)))}
												value={draft}
												onChange={(e) => setDrafts((d) => ({ ...d, [row.string_id]: e.target.value }))}
											/>
											{row.translation_status && (
												<div className="ztrans-mt-1">
													<StatusPill tone="translated">{row.translation_status}</StatusPill>
												</div>
											)}
										</td>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-text-xs ztrans-text-ztrans-muted">{row.domain || '—'}</td>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
											<div className="ztrans-flex ztrans-flex-col ztrans-gap-1">
												<Button size="sm" onClick={() => onSave(row.string_id)}>
													{__('Save', 'gemtranslate')}
												</Button>
												<Button size="sm" variant="ghost" onClick={() => onAI(row)}>
													{__('AI', 'gemtranslate')}
												</Button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}

				{strings.data?.meta?.total > strings.data?.meta?.per_page && (
					<div className="ztrans-flex ztrans-justify-between ztrans-border-t ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm">
						<span className="ztrans-text-ztrans-muted">
							{sprintf(
								/* translators: %d: total count. */
								__('%d total', 'gemtranslate'),
								strings.data?.meta?.total
							)}
						</span>
						<div className="ztrans-flex ztrans-gap-2">
							<Button variant="ghost" size="sm" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
								{__('Previous', 'gemtranslate')}
							</Button>
							<Button variant="ghost" size="sm" onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
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

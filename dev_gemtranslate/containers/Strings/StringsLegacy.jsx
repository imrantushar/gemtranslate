import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import SearchBox from '../../components/SearchBox';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { TableSkeleton } from '../../components/Skeleton';
import { Field, TextInput, TextArea } from '../../components/Input';
import { Select } from '../../components/ui/Select';
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

			<Card table>
				<Table.Toolbar>
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-end gtrans-gap-3">
					<div className="gtrans-min-w-[160px]">
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
					<div className="gtrans-min-w-[160px]">
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
					</div>
					<SearchBox
						value={filters.search}
						placeholder={__('Search source…', 'gemtranslate')}
						onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
					/>
				</Table.Toolbar>

				{strings.isLoading ? (
					<TableSkeleton />
				) : (strings.data?.rows || []).length === 0 ? (
					<Table.Empty columns={[__('Source', 'gemtranslate'), __('Translation', 'gemtranslate'), __('Domain', 'gemtranslate'), '']}>
						{__('No strings yet. Scan a theme or plugin to populate this list.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader className="gtrans-w-1/3">{__('Source', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>
									{sprintf(
										/* translators: %s: language code. */
										__('Translation (%s)', 'gemtranslate'),
										filters.lang
									)}
								</Table.ColumnHeader>
								<Table.ColumnHeader className="gtrans-w-32">{__('Domain', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader className="gtrans-w-32" />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{(strings.data?.rows || []).map((row) => {
								const draft = drafts[row.string_id] ?? row.translation ?? '';
								return (
									<Table.Row key={row.string_id} className="gtrans-align-top">
										<Table.Cell>
											<div className="gtrans-text-ink">{truncate(row.source, 240)}</div>
											{row.file_ref && (
												<div className="gtrans-mt-1 gtrans-text-xs gtrans-text-muted"><code>{row.file_ref}</code></div>
											)}
										</Table.Cell>
										<Table.Cell>
											<TextArea
												rows={Math.min(6, Math.max(2, Math.ceil(row.source.length / 80)))}
												value={draft}
												onChange={(e) => setDrafts((d) => ({ ...d, [row.string_id]: e.target.value }))}
											/>
											{row.translation_status && (
												<div className="gtrans-mt-1">
													<StatusPill tone="translated">{row.translation_status}</StatusPill>
												</div>
											)}
										</Table.Cell>
										<Table.Cell className="gtrans-text-xs gtrans-text-muted">{row.domain || '—'}</Table.Cell>
										<Table.Cell className="gtrans-text-right">
											<div className="gtrans-flex gtrans-flex-col gtrans-gap-1">
												<Button size="sm" onClick={() => onSave(row.string_id)}>
													{__('Save', 'gemtranslate')}
												</Button>
												<Button size="sm" variant="ghost" onClick={() => onAI(row)}>
													{__('AI', 'gemtranslate')}
												</Button>
											</div>
										</Table.Cell>
									</Table.Row>
								);
							})}
						</Table.Body>
					</Table.Root>
				)}

				{strings.data?.meta?.total > strings.data?.meta?.per_page && (
					<div className="gtrans-flex gtrans-justify-between gtrans-mt-3 gtrans-text-sm">
						<span className="gtrans-text-muted">
							{sprintf(
								/* translators: %d: total count. */
								__('%d total', 'gemtranslate'),
								strings.data?.meta?.total
							)}
						</span>
						<div className="gtrans-flex gtrans-gap-2">
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

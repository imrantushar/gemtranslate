import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import SidebarLayout, { SidebarNav, Panel } from '../../components/SidebarLayout';
import { useSubmenus } from '../../components/nav';
import Modal from '../../components/Modal';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import SearchBox from '../../components/SearchBox';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, TextInput, TextArea } from '../../components/Input';
import { Select } from '../../components/ui/Select';
import { PageSkeleton, TableSkeleton } from '../../components/Skeleton';
import { useTerms, useTermTranslations, useSaveTermTranslation } from '../../hooks/useTerms';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

// The select menu is portalled to <body>; lift it above the modal overlay.
const modalSelectStyles = {
	menuPortal: (base) => ({ ...base, zIndex: 100001 }),
};

export default function TermsPage() {
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);
	const defaultLang = (langs.data || []).find((l) => l.is_default);

	// Taxonomy is chosen from the sidebar submenu (?tax=post_tag).
	const [params, setParams] = useSearchParams();
	const { taxonomies } = useSubmenus();
	const taxonomy = params.get('tax') || 'category';
	const [filters, setFilters] = useState({ search: '', per_page: 100 });
	const [selectedTerm, setSelectedTerm] = useState(null);
	const [selectedLang, setSelectedLang] = useState('');
	const [form, setForm] = useState({ name: '', description: '', slug: '' });
	const [toast, setToast] = useState(null);

	const terms = useTerms({ ...filters, taxonomy });
	const detail = useTermTranslations(selectedTerm);
	const save = useSaveTermTranslation();

	useEffect(() => {
		setSelectedTerm(null);
	}, [taxonomy]);

	useEffect(() => {
		if (!nonDefault.length || selectedLang) return;
		setSelectedLang(nonDefault[0].code);
	}, [nonDefault, selectedLang]);

	useEffect(() => {
		if (!detail.data) return;
		const row = (detail.data.translations || []).find((t) => t.language.code === selectedLang);
		setForm({
			name: row?.translation?.name ?? '',
			description: row?.translation?.description ?? '',
			slug: row?.translation?.slug ?? '',
		});
	}, [detail.data, selectedLang]);

	const submit = async (e) => {
		e?.preventDefault();
		try {
			await save.mutateAsync({ termId: selectedTerm, lang: selectedLang, payload: form });
			setToast({ tone: 'success', message: __('Term translation saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	if (langs.isLoading) return <PageSkeleton />;

	return (
		<>
			<SidebarLayout
				nav={
					<SidebarNav
						label={__('Taxonomies', 'gemtranslate')}
						items={taxonomies}
						active={taxonomy}
						onSelect={(key) => setParams({ tax: key })}
					/>
				}
			>
			<Panel
				title={taxonomies.find((t) => t.key === taxonomy)?.label || __('Taxonomies', 'gemtranslate')}
				description={__('Translate categories, tags, and other taxonomy terms.', 'gemtranslate')}
				actions={
					<SearchBox
						value={filters.search}
						placeholder={__('Search terms…', 'gemtranslate')}
						onSearch={(search) => setFilters((f) => ({ ...f, search }))}
					/>
				}
			>
				{terms.isLoading ? (
					<TableSkeleton />
				) : (terms.data?.rows || []).length === 0 ? (
					<Table.Empty columns={[__('Name', 'gemtranslate'), __('Slug', 'gemtranslate'), __('Count', 'gemtranslate'), '']}>
						{__('No terms found.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>{__('Name', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Slug', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Count', 'gemtranslate')}</Table.ColumnHeader>
								{nonDefault.map((l) => (
									<Table.ColumnHeader key={l.code}>{l.code.toUpperCase()}</Table.ColumnHeader>
								))}
								<Table.ColumnHeader />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{(terms.data?.rows || []).map((row) => (
								<Table.Row key={row.id}>
									<Table.Cell className="gtrans-font-medium">{row.name}</Table.Cell>
									<Table.Cell className="gtrans-text-muted"><code>{row.slug}</code></Table.Cell>
									<Table.Cell className="gtrans-text-muted">{row.count}</Table.Cell>
									{nonDefault.map((l) => (
										<Table.Cell key={l.code}>
											{row.translations_status?.[l.code] ? (
												<StatusPill tone="translated">✓</StatusPill>
											) : (
												<StatusPill tone="none">—</StatusPill>
											)}
										</Table.Cell>
									))}
									<Table.Cell className="gtrans-text-right">
										<Button size="sm" onClick={() => setSelectedTerm(row.id)}>
											{__('Translate', 'gemtranslate')}
										</Button>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
					<Table.Footer>
						<span className="gtrans-text-muted">
							{sprintf(__('Showing result %1$d out of %2$d', 'gemtranslate'), terms.data.rows.length, terms.data.rows.length)}
						</span>
					</Table.Footer>
					</>
				)}
			</Panel>
			</SidebarLayout>

			{selectedTerm && (
				<Modal
					open
					onClose={() => setSelectedTerm(null)}
					size="lg"
					title={
						detail.data
							? sprintf(/* translators: %s: term name. */ __('Translate “%s”', 'gemtranslate'), detail.data.term.name)
							: __('Translate term', 'gemtranslate')
					}
					footer={
						<>
							<Button variant="secondary" onClick={() => setSelectedTerm(null)}>
								{__('Close', 'gemtranslate')}
							</Button>
							<Button loading={save.isPending} disabled={!detail.data} onClick={submit}>
								{__('Save translation', 'gemtranslate')}
							</Button>
						</>
					}
				>
					{!detail.data ? (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('Loading…', 'gemtranslate')}</p>
					) : (
						<form onSubmit={submit} className="gtrans-grid gtrans-grid-cols-1 gtrans-gap-6 md:gtrans-grid-cols-2">
							<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
								<h4 className="gtrans-m-0 gtrans-flex gtrans-h-9 gtrans-items-center gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
									{sprintf(/* translators: %s: lang code. */ __('Source — %s', 'gemtranslate'), defaultLang?.code || '')}
								</h4>
								<Field label={__('Name', 'gemtranslate')}>
									<TextInput value={detail.data.term.name} readOnly />
								</Field>
								<Field label={__('Slug', 'gemtranslate')}>
									<TextInput value={detail.data.term.slug} readOnly />
								</Field>
								<Field label={__('Description', 'gemtranslate')}>
									<TextArea rows={5} value={detail.data.term.description || ''} readOnly />
								</Field>
							</div>

							<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
								<div className="gtrans-flex gtrans-h-9 gtrans-items-center gtrans-justify-between gtrans-gap-3">
									<h4 className="gtrans-m-0 gtrans-whitespace-nowrap gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
										{sprintf(/* translators: %s: lang code. */ __('Translation — %s', 'gemtranslate'), selectedLang)}
									</h4>
									<Select styles={modalSelectStyles} className="gtrans-w-40" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
										{nonDefault.map((l) => (
											<option key={l.code} value={l.code}>{l.name}</option>
										))}
									</Select>
								</div>
								<Field label={__('Name', 'gemtranslate')}>
									<TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
								</Field>
								<Field label={__('Slug', 'gemtranslate')}>
									<TextInput value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
								</Field>
								<Field label={__('Description', 'gemtranslate')}>
									<TextArea rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
								</Field>
							</div>
						</form>
					)}
				</Modal>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

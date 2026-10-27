import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
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
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

export default function TermsPage() {
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);
	const defaultLang = (langs.data || []).find((l) => l.is_default);

	// Taxonomy is chosen from the sidebar submenu (?tax=post_tag).
	const [params] = useSearchParams();
	const taxonomy = params.get('tax') || 'category';
	const [filters, setFilters] = useState({ search: '', per_page: 100 });
	const [selectedTerm, setSelectedTerm] = useState(null);
	const [selectedLang, setSelectedLang] = useState('');
	const [form, setForm] = useState({ name: '', description: '', slug: '' });
	const [toast, setToast] = useState(null);

	const terms = useTerms({ ...filters, taxonomy });
	const detail = useTermTranslations(selectedTerm);
	const save = useSaveTermTranslation();
	const ai = useTranslateWithAI();

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
		e.preventDefault();
		try {
			await save.mutateAsync({ termId: selectedTerm, lang: selectedLang, payload: form });
			setToast({ tone: 'success', message: __('Term translation saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFill = async (field, sourceText) => {
		try {
			const res = await ai.mutateAsync({
				text: sourceText,
				source_lang: defaultLang?.code || 'en',
				target_lang: selectedLang,
				preserve_html: field === 'description',
				use_memory: true,
			});
			setForm((f) => ({ ...f, [field]: res.translations }));
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFillAll = async () => {
		if (!detail.data?.term) return;
		const t = detail.data.term;
		try {
			const res = await ai.mutateAsync({
				text: [t.name, t.description || ''],
				source_lang: defaultLang?.code || 'en',
				target_lang: selectedLang,
				preserve_html: true,
				use_memory: true,
			});
			setForm((f) => ({
				...f,
				name: res.translations[0] || f.name,
				description: res.translations[1] || f.description,
			}));
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	if (langs.isLoading) return <PageSkeleton />;

	return (
		<>
			<PageHeader
				title={__('Taxonomies', 'gemtranslate')}
				description={__('Translate categories, tags, and other taxonomy terms.', 'gemtranslate')}
				actions={
					<SearchBox
						value={filters.search}
						placeholder={__('Search terms…', 'gemtranslate')}
						onSearch={(search) => setFilters((f) => ({ ...f, search }))}
					/>
				}
			/>

			<Card table className="gtrans-mb-6">

				{terms.isLoading ? (
					<TableSkeleton />
				) : (terms.data?.rows || []).length === 0 ? (
					<Table.Empty>
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
			</Card>

			{selectedTerm && detail.data && (
				<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-6">
					<Card title={sprintf(/* translators: %s: lang code. */ __('Source — %s', 'gemtranslate'), defaultLang?.code || '')}>
						<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
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
					</Card>

					<Card
						title={sprintf(/* translators: %s: lang code. */ __('Translation — %s', 'gemtranslate'), selectedLang)}
						action={
							<Select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
								{nonDefault.map((l) => (
									<option key={l.code} value={l.code}>{l.name}</option>
								))}
							</Select>
						}
					>
						<form onSubmit={submit} className="gtrans-flex gtrans-flex-col gtrans-gap-3">
							<div className="gtrans-flex gtrans-items-end gtrans-gap-2">
								<div className="gtrans-flex-1">
									<Field label={__('Name', 'gemtranslate')}>
										<TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
									</Field>
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFill('name', detail.data.term.name)}>
									{__('AI', 'gemtranslate')}
								</Button>
							</div>
							<Field label={__('Slug', 'gemtranslate')}>
								<TextInput value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
							</Field>
							<div className="gtrans-flex gtrans-items-end gtrans-gap-2">
								<div className="gtrans-flex-1">
									<Field label={__('Description', 'gemtranslate')}>
										<TextArea rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
									</Field>
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFill('description', detail.data.term.description || '')}>
									{__('AI', 'gemtranslate')}
								</Button>
							</div>
							<div className="gtrans-mt-2 gtrans-flex gtrans-justify-between">
								<Button variant="secondary" size="sm" onClick={aiFillAll} loading={ai.isPending}>
									{__('Translate all with AI', 'gemtranslate')}
								</Button>
								<Button type="submit" loading={save.isPending}>
									{__('Save translation', 'gemtranslate')}
								</Button>
							</div>
						</form>
					</Card>
				</div>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

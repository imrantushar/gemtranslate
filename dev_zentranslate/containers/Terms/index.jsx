import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, Select, TextInput, TextArea } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useTerms, useTermTranslations, useSaveTermTranslation } from '../../hooks/useTerms';
import { useLanguages } from '../../hooks/useLanguages';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

export default function TermsPage() {
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);
	const defaultLang = (langs.data || []).find((l) => l.is_default);

	const [taxonomy, setTaxonomy] = useState('category');
	const [search, setSearch] = useState('');
	const [filters, setFilters] = useState({ taxonomy: 'category', search: '', per_page: 100 });
	const [selectedTerm, setSelectedTerm] = useState(null);
	const [selectedLang, setSelectedLang] = useState('');
	const [form, setForm] = useState({ name: '', description: '', slug: '' });
	const [toast, setToast] = useState(null);

	const terms = useTerms(filters);
	const detail = useTermTranslations(selectedTerm);
	const save = useSaveTermTranslation();
	const ai = useTranslateWithAI();

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
			setToast({ tone: 'success', message: __('Term translation saved.', 'zentranslate') });
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

	const runSearch = (e) => {
		e.preventDefault();
		setFilters({ taxonomy, search, per_page: 100 });
	};

	if (langs.isLoading) return <LoadingBlock>{__('Loading…', 'zentranslate')}</LoadingBlock>;

	return (
		<>
			<PageHeader
				title={__('Taxonomies', 'zentranslate')}
				description={__('Translate categories, tags, and other taxonomy terms.', 'zentranslate')}
			/>

			<Card padded={false} className="ztrans-mb-6">
				<form onSubmit={runSearch} className="ztrans-flex ztrans-flex-wrap ztrans-items-end ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3">
					<Field label={__('Taxonomy', 'zentranslate')}>
						<Select value={taxonomy} onChange={(e) => setTaxonomy(e.target.value)}>
							<option value="category">{__('Categories', 'zentranslate')}</option>
							<option value="post_tag">{__('Tags', 'zentranslate')}</option>
							<option value="product_cat">{__('Product categories', 'zentranslate')}</option>
							<option value="product_tag">{__('Product tags', 'zentranslate')}</option>
						</Select>
					</Field>
					<div className="ztrans-min-w-[200px] ztrans-flex-1">
						<Field label={__('Search', 'zentranslate')}>
							<TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={__('Search…', 'zentranslate')} />
						</Field>
					</div>
					<Button type="submit" variant="secondary">{__('Filter', 'zentranslate')}</Button>
				</form>

				{terms.isLoading ? (
					<LoadingBlock>{__('Loading terms…', 'zentranslate')}</LoadingBlock>
				) : (terms.data?.rows || []).length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No terms found.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Name', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Slug', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Count', 'zentranslate')}</th>
								{nonDefault.map((l) => (
									<th key={l.code} className="ztrans-px-4 ztrans-py-3">{l.code.toUpperCase()}</th>
								))}
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(terms.data?.rows || []).map((row) => (
								<tr key={row.id} className="ztrans-border-t ztrans-border-ztrans-border">
									<td className="ztrans-px-4 ztrans-py-3 ztrans-font-medium">{row.name}</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-ztrans-muted"><code>{row.slug}</code></td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-ztrans-muted">{row.count}</td>
									{nonDefault.map((l) => (
										<td key={l.code} className="ztrans-px-4 ztrans-py-3">
											{row.translations_status?.[l.code] ? (
												<StatusPill tone="translated">✓</StatusPill>
											) : (
												<StatusPill tone="none">—</StatusPill>
											)}
										</td>
									))}
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
										<Button size="sm" onClick={() => setSelectedTerm(row.id)}>
											{__('Translate', 'zentranslate')}
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>

			{selectedTerm && detail.data && (
				<div className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-6">
					<Card title={sprintf(/* translators: %s: lang code. */ __('Source — %s', 'zentranslate'), defaultLang?.code || '')}>
						<div className="ztrans-flex ztrans-flex-col ztrans-gap-3">
							<Field label={__('Name', 'zentranslate')}>
								<TextInput value={detail.data.term.name} readOnly />
							</Field>
							<Field label={__('Slug', 'zentranslate')}>
								<TextInput value={detail.data.term.slug} readOnly />
							</Field>
							<Field label={__('Description', 'zentranslate')}>
								<TextArea rows={5} value={detail.data.term.description || ''} readOnly />
							</Field>
						</div>
					</Card>

					<Card
						title={sprintf(/* translators: %s: lang code. */ __('Translation — %s', 'zentranslate'), selectedLang)}
						action={
							<Select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
								{nonDefault.map((l) => (
									<option key={l.code} value={l.code}>{l.name}</option>
								))}
							</Select>
						}
					>
						<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-3">
							<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
								<div className="ztrans-flex-1">
									<Field label={__('Name', 'zentranslate')}>
										<TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
									</Field>
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFill('name', detail.data.term.name)}>
									{__('AI', 'zentranslate')}
								</Button>
							</div>
							<Field label={__('Slug', 'zentranslate')}>
								<TextInput value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
							</Field>
							<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
								<div className="ztrans-flex-1">
									<Field label={__('Description', 'zentranslate')}>
										<TextArea rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
									</Field>
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFill('description', detail.data.term.description || '')}>
									{__('AI', 'zentranslate')}
								</Button>
							</div>
							<div className="ztrans-mt-2 ztrans-flex ztrans-justify-between">
								<Button variant="secondary" size="sm" onClick={aiFillAll} loading={ai.isPending}>
									{__('Translate all with AI', 'zentranslate')}
								</Button>
								<Button type="submit" loading={save.isPending}>
									{__('Save translation', 'zentranslate')}
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

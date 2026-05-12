import { useState } from 'react';
import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, Select, TextInput, Checkbox } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useGlossary, useAddGlossaryTerm, useDeleteGlossaryTerm } from '../../hooks/useAI';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

export default function GlossaryPage() {
	const list = useGlossary();
	const add = useAddGlossaryTerm();
	const del = useDeleteGlossaryTerm();
	const langs = useLanguages();
	const defaultLang = (langs.data || []).find((l) => l.is_default);
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);

	const [form, setForm] = useState({
		source_lang: defaultLang?.code || '',
		target_lang: nonDefault[0]?.code || '',
		source_term: '',
		target_term: '',
		case_sensitive: false,
		do_not_translate: false,
	});
	const [toast, setToast] = useState(null);

	const submit = async (e) => {
		e.preventDefault();
		if (!form.source_term) {
			setToast({ tone: 'error', message: __('Source term is required.', 'zentranslate') });
			return;
		}
		try {
			await add.mutateAsync(form);
			setForm((f) => ({ ...f, source_term: '', target_term: '' }));
			setToast({ tone: 'success', message: __('Glossary term added.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onDelete = async (id) => {
		if (!window.confirm(__('Delete this glossary entry?', 'zentranslate'))) return;
		try {
			await del.mutateAsync(id);
			setToast({ tone: 'success', message: __('Removed.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	if (list.isLoading || langs.isLoading) return <LoadingBlock>{__('Loading glossary…', 'zentranslate')}</LoadingBlock>;

	return (
		<>
			<PageHeader
				title={__('Glossary', 'zentranslate')}
				description={__('Define brand terms and protected phrases so AI translations stay consistent.', 'zentranslate')}
			/>

			<Card title={__('Add a term', 'zentranslate')} className="ztrans-mb-6">
				<form onSubmit={submit} className="ztrans-grid ztrans-grid-cols-1 md:ztrans-grid-cols-2 ztrans-gap-4">
					<Field label={__('Source language', 'zentranslate')}>
						<Select value={form.source_lang} onChange={(e) => setForm((f) => ({ ...f, source_lang: e.target.value }))}>
							{(langs.data || []).map((l) => (
								<option key={l.code} value={l.code}>{l.name}</option>
							))}
						</Select>
					</Field>
					<Field label={__('Target language', 'zentranslate')}>
						<Select value={form.target_lang} onChange={(e) => setForm((f) => ({ ...f, target_lang: e.target.value }))}>
							{nonDefault.map((l) => (
								<option key={l.code} value={l.code}>{l.name}</option>
							))}
						</Select>
					</Field>
					<Field label={__('Source term', 'zentranslate')} hint={__('e.g. Acme Cloud', 'zentranslate')}>
						<TextInput value={form.source_term} onChange={(e) => setForm((f) => ({ ...f, source_term: e.target.value }))} />
					</Field>
					<Field label={__('Target term', 'zentranslate')} hint={__('Leave empty if do-not-translate.', 'zentranslate')}>
						<TextInput
							value={form.target_term}
							onChange={(e) => setForm((f) => ({ ...f, target_term: e.target.value }))}
							disabled={form.do_not_translate}
						/>
					</Field>
					<div className="ztrans-flex ztrans-flex-col ztrans-gap-2 md:ztrans-col-span-2">
						<Checkbox
							label={__('Case sensitive', 'zentranslate')}
							checked={form.case_sensitive}
							onChange={(e) => setForm((f) => ({ ...f, case_sensitive: e.target.checked }))}
						/>
						<Checkbox
							label={__('Do not translate (keep source verbatim)', 'zentranslate')}
							checked={form.do_not_translate}
							onChange={(e) => setForm((f) => ({ ...f, do_not_translate: e.target.checked }))}
						/>
					</div>
					<div className="md:ztrans-col-span-2 ztrans-flex ztrans-justify-end">
						<Button type="submit" loading={add.isPending}>{__('Add term', 'zentranslate')}</Button>
					</div>
				</form>
			</Card>

			<Card padded={false} title={__('Existing terms', 'zentranslate')}>
				{(list.data || []).length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No glossary entries yet.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Source', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Target', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Pair', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Flags', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(list.data || []).map((row) => (
								<tr key={row.term_id} className="ztrans-border-t ztrans-border-ztrans-border">
									<td className="ztrans-px-4 ztrans-py-3 ztrans-font-medium">{row.source_term}</td>
									<td className="ztrans-px-4 ztrans-py-3">{row.target_term || <em className="ztrans-text-ztrans-muted">{__('(do not translate)', 'zentranslate')}</em>}</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-ztrans-muted">
										<code>{row.source_lang}</code> → <code>{row.target_lang}</code>
									</td>
									<td className="ztrans-px-4 ztrans-py-3">
										{Number(row.case_sensitive) === 1 && <StatusPill>{__('Aa', 'zentranslate')}</StatusPill>}
										{Number(row.do_not_translate) === 1 && <StatusPill tone="draft">{__('DNT', 'zentranslate')}</StatusPill>}
									</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
										<Button variant="ghost" size="sm" onClick={() => onDelete(row.term_id)}>
											{__('Delete', 'zentranslate')}
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

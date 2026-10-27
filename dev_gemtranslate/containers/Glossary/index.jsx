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
			setToast({ tone: 'error', message: __('Source term is required.', 'gemtranslate') });
			return;
		}
		try {
			await add.mutateAsync(form);
			setForm((f) => ({ ...f, source_term: '', target_term: '' }));
			setToast({ tone: 'success', message: __('Glossary term added.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onDelete = async (id) => {
		if (!window.confirm(__('Delete this glossary entry?', 'gemtranslate'))) return;
		try {
			await del.mutateAsync(id);
			setToast({ tone: 'success', message: __('Removed.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	if (list.isLoading || langs.isLoading) return <LoadingBlock>{__('Loading glossary…', 'gemtranslate')}</LoadingBlock>;

	return (
		<>
			<PageHeader
				title={__('Glossary', 'gemtranslate')}
				description={__('Define brand terms and protected phrases so AI translations stay consistent.', 'gemtranslate')}
			/>

			<Card title={__('Add a term', 'gemtranslate')} className="gtrans-mb-6">
				<form onSubmit={submit} className="gtrans-grid gtrans-grid-cols-1 md:gtrans-grid-cols-2 gtrans-gap-4">
					<Field label={__('Source language', 'gemtranslate')}>
						<Select value={form.source_lang} onChange={(e) => setForm((f) => ({ ...f, source_lang: e.target.value }))}>
							{(langs.data || []).map((l) => (
								<option key={l.code} value={l.code}>{l.name}</option>
							))}
						</Select>
					</Field>
					<Field label={__('Target language', 'gemtranslate')}>
						<Select value={form.target_lang} onChange={(e) => setForm((f) => ({ ...f, target_lang: e.target.value }))}>
							{nonDefault.map((l) => (
								<option key={l.code} value={l.code}>{l.name}</option>
							))}
						</Select>
					</Field>
					<Field label={__('Source term', 'gemtranslate')} hint={__('e.g. Acme Cloud', 'gemtranslate')}>
						<TextInput value={form.source_term} onChange={(e) => setForm((f) => ({ ...f, source_term: e.target.value }))} />
					</Field>
					<Field label={__('Target term', 'gemtranslate')} hint={__('Leave empty if do-not-translate.', 'gemtranslate')}>
						<TextInput
							value={form.target_term}
							onChange={(e) => setForm((f) => ({ ...f, target_term: e.target.value }))}
							disabled={form.do_not_translate}
						/>
					</Field>
					<div className="gtrans-flex gtrans-flex-col gtrans-gap-2 md:gtrans-col-span-2">
						<Checkbox
							label={__('Case sensitive', 'gemtranslate')}
							checked={form.case_sensitive}
							onChange={(e) => setForm((f) => ({ ...f, case_sensitive: e.target.checked }))}
						/>
						<Checkbox
							label={__('Do not translate (keep source verbatim)', 'gemtranslate')}
							checked={form.do_not_translate}
							onChange={(e) => setForm((f) => ({ ...f, do_not_translate: e.target.checked }))}
						/>
					</div>
					<div className="md:gtrans-col-span-2 gtrans-flex gtrans-justify-end">
						<Button type="submit" loading={add.isPending}>{__('Add term', 'gemtranslate')}</Button>
					</div>
				</form>
			</Card>

			<Card padded={false} title={__('Existing terms', 'gemtranslate')}>
				{(list.data || []).length === 0 ? (
					<p className="gtrans-px-5 gtrans-py-8 gtrans-text-center gtrans-text-sm gtrans-text-gtrans-muted">
						{__('No glossary entries yet.', 'gemtranslate')}
					</p>
				) : (
					<table className="gtrans-w-full gtrans-text-sm">
						<thead className="gtrans-bg-gtrans-bg gtrans-text-left gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
							<tr>
								<th className="gtrans-px-4 gtrans-py-3">{__('Source', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Target', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Pair', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Flags', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(list.data || []).map((row) => (
								<tr key={row.term_id} className="gtrans-border-t gtrans-border-gtrans-border">
									<td className="gtrans-px-4 gtrans-py-3 gtrans-font-medium">{row.source_term}</td>
									<td className="gtrans-px-4 gtrans-py-3">{row.target_term || <em className="gtrans-text-gtrans-muted">{__('(do not translate)', 'gemtranslate')}</em>}</td>
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-gtrans-muted">
										<code>{row.source_lang}</code> → <code>{row.target_lang}</code>
									</td>
									<td className="gtrans-px-4 gtrans-py-3">
										{Number(row.case_sensitive) === 1 && <StatusPill>{__('Aa', 'gemtranslate')}</StatusPill>}
										{Number(row.do_not_translate) === 1 && <StatusPill tone="draft">{__('DNT', 'gemtranslate')}</StatusPill>}
									</td>
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-right">
										<Button variant="ghost" size="sm" onClick={() => onDelete(row.term_id)}>
											{__('Delete', 'gemtranslate')}
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

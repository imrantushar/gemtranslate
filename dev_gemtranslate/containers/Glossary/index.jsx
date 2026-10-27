import { useState } from 'react';
import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';

import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, TextInput, Checkbox } from '../../components/Input';
import { Select } from '../../components/ui/Select';
import { PageSkeleton } from '../../components/Skeleton';
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
	const [query, setQuery] = useState('');

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

	if (list.isLoading || langs.isLoading) return <PageSkeleton />;

	return (
		<>
			<PageHeader
				title={__('Glossary', 'gemtranslate')}
				description={__('Define brand terms and protected phrases so AI translations stay consistent.', 'gemtranslate')}
				actions={
					<SearchBox value={query} placeholder={__('Search terms…', 'gemtranslate')} onSearch={setQuery} />
				}
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

			<Card table title={__('Existing terms', 'gemtranslate')}>
				{(list.data || []).length === 0 ? (
					<Table.Empty>
						{__('No glossary entries yet.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>{__('Source', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Target', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Pair', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Flags', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{(list.data || []).filter((row) => !query || `${row.source_term} ${row.target_term || ''}`.toLowerCase().includes(query.toLowerCase())).map((row) => (
								<Table.Row key={row.term_id}>
									<Table.Cell className="gtrans-font-medium">{row.source_term}</Table.Cell>
									<Table.Cell>{row.target_term || <em className="gtrans-text-muted">{__('(do not translate)', 'gemtranslate')}</em>}</Table.Cell>
									<Table.Cell className="gtrans-text-muted">
										<code>{row.source_lang}</code> → <code>{row.target_lang}</code>
									</Table.Cell>
									<Table.Cell>
										{Number(row.case_sensitive) === 1 && <StatusPill>{__('Aa', 'gemtranslate')}</StatusPill>}
										{Number(row.do_not_translate) === 1 && <StatusPill tone="draft">{__('DNT', 'gemtranslate')}</StatusPill>}
									</Table.Cell>
									<Table.Cell className="gtrans-text-right">
										<Button variant="ghost" size="sm" onClick={() => onDelete(row.term_id)}>
											{__('Delete', 'gemtranslate')}
										</Button>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

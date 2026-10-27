import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';

import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { PageSkeleton } from '../../components/Skeleton';
import { Checkbox } from '../../components/Input';
import { useTranslators, useSaveTranslatorLanguages } from '../../hooks/useTranslators';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

export default function TranslatorsPage() {
	const list = useTranslators();
	const langs = useLanguages();
	const save = useSaveTranslatorLanguages();
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);
	const [query, setQuery] = useState('');
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);

	useEffect(() => {
		if (!list.data) return;
		const init = {};
		list.data.forEach((u) => { init[u.id] = u.languages || []; });
		setDrafts(init);
	}, [list.data]);

	if (list.isLoading || langs.isLoading) return <PageSkeleton />;

	const toggle = (userId, code) =>
		setDrafts((d) => {
			const cur = d[userId] || [];
			return { ...d, [userId]: cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code] };
		});

	const onSave = async (userId) => {
		try {
			await save.mutateAsync({ userId, languages: drafts[userId] || [] });
			setToast({ tone: 'success', message: __('Assignments saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Translators', 'gemtranslate')}
				description={__('Users with the translate capability. Assign each user to specific languages, or leave empty for unrestricted access.', 'gemtranslate')}
				actions={
					<SearchBox value={query} placeholder={__('Search users…', 'gemtranslate')} onSearch={setQuery} />
				}
			/>

			<Card table>
				{list.data.length === 0 ? (
					<Table.Empty>
						{__('No users with translator access. Edit users and assign them the Translator role or grant the gtrans_translate_content capability.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>{__('User', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Roles', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Languages', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{list.data.filter((u) => !query || `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase())).map((u) => {
								const picked = drafts[u.id] || [];
								return (
									<Table.Row key={u.id} className="gtrans-align-top">
										<Table.Cell>
											<div className="gtrans-font-medium">{u.name}</div>
											<div className="gtrans-text-xs gtrans-text-muted">{u.email}</div>
										</Table.Cell>
										<Table.Cell className="gtrans-text-xs gtrans-text-muted">
											{u.roles.join(', ')}
										</Table.Cell>
										<Table.Cell>
											<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-2">
												{nonDefault.map((l) => (
													<Checkbox
														key={l.code}
														label={`${l.name} (${l.code})`}
														checked={picked.includes(l.code)}
														onChange={() => toggle(u.id, l.code)}
													/>
												))}
											</div>
											{picked.length === 0 && (
												<div className="gtrans-mt-2"><StatusPill>{__('Unrestricted', 'gemtranslate')}</StatusPill></div>
											)}
										</Table.Cell>
										<Table.Cell className="gtrans-text-right">
											<Button size="sm" onClick={() => onSave(u.id)} loading={save.isPending}>
												{__('Save', 'gemtranslate')}
											</Button>
										</Table.Cell>
									</Table.Row>
								);
							})}
						</Table.Body>
					</Table.Root>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

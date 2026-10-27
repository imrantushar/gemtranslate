import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';

import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { PageSkeleton } from '../../components/Skeleton';
import { Table } from '../../components/ui/Table';
import {
	useLanguages,
	useCreateLanguage,
	useUpdateLanguage,
	useDeleteLanguage,
	useSetDefaultLanguage,
} from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';
import LanguageForm from './LanguageForm';

export default function LanguagesPage() {
	const languages = useLanguages();
	const create = useCreateLanguage();
	const update = useUpdateLanguage();
	const remove = useDeleteLanguage();
	const setDefault = useSetDefaultLanguage();

	const [tab, setTab] = useState('all');
	const [query, setQuery] = useState('');
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [toast, setToast] = useState(null);

	const openCreate = () => {
		setEditing(null);
		setModalOpen(true);
	};
	const openEdit = (lang) => {
		setEditing(lang);
		setModalOpen(true);
	};
	const close = () => setModalOpen(false);

	const submit = async (values) => {
		try {
			if (editing) {
				await update.mutateAsync({ code: editing.code, ...values });
				setToast({ tone: 'success', message: __('Language updated.', 'gemtranslate') });
			} else {
				await create.mutateAsync(values);
				setToast({ tone: 'success', message: __('Language added.', 'gemtranslate') });
			}
			close();
		} catch (e) {
			setToast({ tone: 'error', message: formatErrorMessage(e) });
		}
	};

	const onDelete = async (lang) => {
		const confirmMsg = sprintf(
			/* translators: %s: language name. */
			__('Delete %s? This will remove all of its translations.', 'gemtranslate'),
			lang.name
		);
		if (!window.confirm(confirmMsg)) return;
		try {
			await remove.mutateAsync(lang.code);
			setToast({ tone: 'success', message: __('Language deleted.', 'gemtranslate') });
		} catch (e) {
			setToast({ tone: 'error', message: formatErrorMessage(e) });
		}
	};

	const onMakeDefault = async (lang) => {
		try {
			await setDefault.mutateAsync(lang.code);
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: %s: language name. */
					__('%s is now the default.', 'gemtranslate'),
					lang.name
				),
			});
		} catch (e) {
			setToast({ tone: 'error', message: formatErrorMessage(e) });
		}
	};

	const all = languages.data || [];
	const needle = query.trim().toLowerCase();
	const visible = all.filter((l) => {
		if (tab === 'active' && !l.active) return false;
		if (tab === 'inactive' && l.active) return false;
		return !needle || [l.name, l.native_name, l.code, l.locale].some((v) => String(v || '').toLowerCase().includes(needle));
	});

	if (languages.isLoading) {
		return <PageSkeleton />;
	}

	return (
		<>
			<PageHeader
				title={__('Languages', 'gemtranslate')}
				description={__('Manage the languages your site supports.', 'gemtranslate')}
				actions={<Button onClick={openCreate}>{__('Add language', 'gemtranslate')}</Button>}
			/>

			<Card table>
				<Table.Toolbar variant="tabs">
					<StatusTabs
						value={tab}
						onChange={setTab}
						tabs={[
							{ value: 'all', label: __('All', 'gemtranslate'), count: all.length },
							{ value: 'active', label: __('Active', 'gemtranslate'), count: all.filter((l) => l.active).length },
							{ value: 'inactive', label: __('Inactive', 'gemtranslate'), count: all.filter((l) => !l.active).length },
						]}
					/>
					<SearchBox value={query} placeholder={__('Search languages…', 'gemtranslate')} onSearch={setQuery} />
				</Table.Toolbar>
				<Table.ScrollArea>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>{__('Language', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Code', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Locale', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Status', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader className="gtrans-text-right">{__('Actions', 'gemtranslate')}</Table.ColumnHeader>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{visible.map((lang) => (
								<Table.Row key={lang.code}>
									<Table.Cell>
										<div className="gtrans-flex gtrans-items-center gtrans-gap-2">
											<strong>{lang.name}</strong>
											<span className="gtrans-text-xs gtrans-text-muted">{lang.native_name}</span>
										</div>
									</Table.Cell>
									<Table.Cell><code>{lang.code}</code></Table.Cell>
									<Table.Cell className="gtrans-text-muted">{lang.locale}</Table.Cell>
									<Table.Cell>
										{lang.is_default && <StatusPill tone="publish">{__('Default', 'gemtranslate')}</StatusPill>}
										{!lang.is_default && lang.active && <StatusPill tone="pending">{__('Active', 'gemtranslate')}</StatusPill>}
										{!lang.active && <StatusPill tone="draft">{__('Inactive', 'gemtranslate')}</StatusPill>}
										{lang.is_rtl && <StatusPill>{__('RTL', 'gemtranslate')}</StatusPill>}
									</Table.Cell>
									<Table.Cell className="gtrans-text-right">
										<div className="gtrans-flex gtrans-justify-end gtrans-gap-2">
											{!lang.is_default && (
												<Button variant="ghost" size="sm" onClick={() => onMakeDefault(lang)}>
													{__('Make default', 'gemtranslate')}
												</Button>
											)}
											<Button variant="secondary" size="sm" onClick={() => openEdit(lang)}>
												{__('Edit', 'gemtranslate')}
											</Button>
											{!lang.is_default && (
												<Button variant="ghost" size="sm" onClick={() => onDelete(lang)}>
													{__('Delete', 'gemtranslate')}
												</Button>
											)}
										</div>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
				</Table.ScrollArea>
			</Card>

			<Modal
				open={modalOpen}
				title={editing ? __('Edit language', 'gemtranslate') : __('Add language', 'gemtranslate')}
				onClose={close}
			>
				<LanguageForm
					initial={editing}
					onCancel={close}
					onSubmit={submit}
					busy={create.isPending || update.isPending}
				/>
			</Modal>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

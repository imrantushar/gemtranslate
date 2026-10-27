import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
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

	if (languages.isLoading) {
		return <LoadingBlock>{__('Loading languages…', 'gemtranslate')}</LoadingBlock>;
	}

	return (
		<>
			<PageHeader
				title={__('Languages', 'gemtranslate')}
				description={__('Manage the languages your site supports.', 'gemtranslate')}
				actions={<Button onClick={openCreate}>{__('Add language', 'gemtranslate')}</Button>}
			/>

			<Card padded={false}>
				<table className="ztrans-w-full ztrans-text-sm">
					<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
						<tr>
							<th className="ztrans-px-4 ztrans-py-3">{__('Language', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3">{__('Code', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3">{__('Locale', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3">{__('Status', 'gemtranslate')}</th>
							<th className="ztrans-px-4 ztrans-py-3 ztrans-text-right">{__('Actions', 'gemtranslate')}</th>
						</tr>
					</thead>
					<tbody>
						{(languages.data || []).map((lang) => (
							<tr key={lang.code} className="ztrans-border-t ztrans-border-ztrans-border">
								<td className="ztrans-px-4 ztrans-py-3">
									<div className="ztrans-flex ztrans-items-center ztrans-gap-2">
										<strong>{lang.name}</strong>
										<span className="ztrans-text-xs ztrans-text-ztrans-muted">{lang.native_name}</span>
									</div>
								</td>
								<td className="ztrans-px-4 ztrans-py-3"><code>{lang.code}</code></td>
								<td className="ztrans-px-4 ztrans-py-3 ztrans-text-ztrans-muted">{lang.locale}</td>
								<td className="ztrans-px-4 ztrans-py-3">
									{lang.is_default && <StatusPill tone="publish">{__('Default', 'gemtranslate')}</StatusPill>}
									{!lang.is_default && lang.active && <StatusPill tone="pending">{__('Active', 'gemtranslate')}</StatusPill>}
									{!lang.active && <StatusPill tone="draft">{__('Inactive', 'gemtranslate')}</StatusPill>}
									{lang.is_rtl && <StatusPill>{__('RTL', 'gemtranslate')}</StatusPill>}
								</td>
								<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
									<div className="ztrans-flex ztrans-justify-end ztrans-gap-2">
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
								</td>
							</tr>
						))}
					</tbody>
				</table>
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

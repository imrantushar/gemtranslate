import { useState } from 'react';

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
				setToast({ tone: 'success', message: 'Language updated.' });
			} else {
				await create.mutateAsync(values);
				setToast({ tone: 'success', message: 'Language added.' });
			}
			close();
		} catch (e) {
			setToast({ tone: 'error', message: formatErrorMessage(e) });
		}
	};

	const onDelete = async (lang) => {
		if (!window.confirm(`Delete ${lang.name}? This will remove all of its translations.`)) return;
		try {
			await remove.mutateAsync(lang.code);
			setToast({ tone: 'success', message: 'Language deleted.' });
		} catch (e) {
			setToast({ tone: 'error', message: formatErrorMessage(e) });
		}
	};

	const onMakeDefault = async (lang) => {
		try {
			await setDefault.mutateAsync(lang.code);
			setToast({ tone: 'success', message: `${lang.name} is now the default.` });
		} catch (e) {
			setToast({ tone: 'error', message: formatErrorMessage(e) });
		}
	};

	if (languages.isLoading) {
		return <LoadingBlock>Loading languages…</LoadingBlock>;
	}

	return (
		<>
			<PageHeader
				title="Languages"
				description="Manage the languages your site supports."
				actions={<Button onClick={openCreate}>Add language</Button>}
			/>

			<Card padded={false}>
				<table className="ztrans-w-full ztrans-text-sm">
					<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
						<tr>
							<th className="ztrans-px-4 ztrans-py-3">Language</th>
							<th className="ztrans-px-4 ztrans-py-3">Code</th>
							<th className="ztrans-px-4 ztrans-py-3">Locale</th>
							<th className="ztrans-px-4 ztrans-py-3">Status</th>
							<th className="ztrans-px-4 ztrans-py-3 ztrans-text-right">Actions</th>
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
									{lang.is_default && <StatusPill tone="publish">Default</StatusPill>}
									{!lang.is_default && lang.active && <StatusPill tone="pending">Active</StatusPill>}
									{!lang.active && <StatusPill tone="draft">Inactive</StatusPill>}
									{lang.is_rtl && <StatusPill>RTL</StatusPill>}
								</td>
								<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
									<div className="ztrans-flex ztrans-justify-end ztrans-gap-2">
										{!lang.is_default && (
											<Button variant="ghost" size="sm" onClick={() => onMakeDefault(lang)}>
												Make default
											</Button>
										)}
										<Button variant="secondary" size="sm" onClick={() => openEdit(lang)}>
											Edit
										</Button>
										{!lang.is_default && (
											<Button variant="ghost" size="sm" onClick={() => onDelete(lang)}>
												Delete
											</Button>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>

			<Modal open={modalOpen} title={editing ? 'Edit language' : 'Add language'} onClose={close}>
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

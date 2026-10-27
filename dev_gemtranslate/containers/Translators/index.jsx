import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
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
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);

	useEffect(() => {
		if (!list.data) return;
		const init = {};
		list.data.forEach((u) => { init[u.id] = u.languages || []; });
		setDrafts(init);
	}, [list.data]);

	if (list.isLoading || langs.isLoading) return <LoadingBlock>{__('Loading translators…', 'gemtranslate')}</LoadingBlock>;

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
			/>

			<Card padded={false}>
				{list.data.length === 0 ? (
					<p className="gtrans-px-5 gtrans-py-8 gtrans-text-center gtrans-text-sm gtrans-text-gtrans-muted">
						{__('No users with translator access. Edit users and assign them the Translator role or grant the gtrans_translate_content capability.', 'gemtranslate')}
					</p>
				) : (
					<table className="gtrans-w-full gtrans-text-sm">
						<thead className="gtrans-bg-gtrans-bg gtrans-text-left gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
							<tr>
								<th className="gtrans-px-4 gtrans-py-3">{__('User', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Roles', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Languages', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{list.data.map((u) => {
								const picked = drafts[u.id] || [];
								return (
									<tr key={u.id} className="gtrans-border-t gtrans-border-gtrans-border gtrans-align-top">
										<td className="gtrans-px-4 gtrans-py-3">
											<div className="gtrans-font-medium">{u.name}</div>
											<div className="gtrans-text-xs gtrans-text-gtrans-muted">{u.email}</div>
										</td>
										<td className="gtrans-px-4 gtrans-py-3 gtrans-text-xs gtrans-text-gtrans-muted">
											{u.roles.join(', ')}
										</td>
										<td className="gtrans-px-4 gtrans-py-3">
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
										</td>
										<td className="gtrans-px-4 gtrans-py-3 gtrans-text-right">
											<Button size="sm" onClick={() => onSave(u.id)} loading={save.isPending}>
												{__('Save', 'gemtranslate')}
											</Button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

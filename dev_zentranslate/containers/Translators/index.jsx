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

	if (list.isLoading || langs.isLoading) return <LoadingBlock>{__('Loading translators…', 'zentranslate')}</LoadingBlock>;

	const toggle = (userId, code) =>
		setDrafts((d) => {
			const cur = d[userId] || [];
			return { ...d, [userId]: cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code] };
		});

	const onSave = async (userId) => {
		try {
			await save.mutateAsync({ userId, languages: drafts[userId] || [] });
			setToast({ tone: 'success', message: __('Assignments saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Translators', 'zentranslate')}
				description={__('Users with the translate capability. Assign each user to specific languages, or leave empty for unrestricted access.', 'zentranslate')}
			/>

			<Card padded={false}>
				{list.data.length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No users with translator access. Edit users and assign them the Translator role or grant the ztrans_translate_content capability.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('User', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Roles', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Languages', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{list.data.map((u) => {
								const picked = drafts[u.id] || [];
								return (
									<tr key={u.id} className="ztrans-border-t ztrans-border-ztrans-border ztrans-align-top">
										<td className="ztrans-px-4 ztrans-py-3">
											<div className="ztrans-font-medium">{u.name}</div>
											<div className="ztrans-text-xs ztrans-text-ztrans-muted">{u.email}</div>
										</td>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-text-xs ztrans-text-ztrans-muted">
											{u.roles.join(', ')}
										</td>
										<td className="ztrans-px-4 ztrans-py-3">
											<div className="ztrans-flex ztrans-flex-wrap ztrans-gap-2">
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
												<div className="ztrans-mt-2"><StatusPill>{__('Unrestricted', 'zentranslate')}</StatusPill></div>
											)}
										</td>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
											<Button size="sm" onClick={() => onSave(u.id)} loading={save.isPending}>
												{__('Save', 'zentranslate')}
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

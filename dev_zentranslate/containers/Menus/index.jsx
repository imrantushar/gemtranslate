import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, Select, TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { api, unwrap } from '../../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

function useMenus() {
	return useQuery({
		queryKey: ['menus'],
		queryFn: async () => unwrap(await api.get('menus')) || [],
	});
}

function useMenuItems(menuId) {
	return useQuery({
		queryKey: ['menus', menuId, 'items'],
		queryFn: async () => unwrap(await api.get(`menus/${menuId}/items`)) || [],
		enabled: !!menuId,
	});
}

function useSaveMenuItem() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ itemId, lang, payload }) =>
			unwrap(await api.put(`menus/items/${itemId}/translations/${lang}`, payload)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
	});
}

export default function MenusPage() {
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);
	const menus = useMenus();
	const [selectedMenu, setSelectedMenu] = useState('');
	const [selectedLang, setSelectedLang] = useState('');
	const items = useMenuItems(selectedMenu);
	const save = useSaveMenuItem();
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!selectedMenu && menus.data?.length) setSelectedMenu(String(menus.data[0].id));
		if (!selectedLang && nonDefault.length) setSelectedLang(nonDefault[0].code);
	}, [menus.data, nonDefault, selectedMenu, selectedLang]);

	if (menus.isLoading || langs.isLoading) return <LoadingBlock>{__('Loading menus…', 'zentranslate')}</LoadingBlock>;

	const onSave = async (item) => {
		const draft = drafts[item.id] || {};
		try {
			await save.mutateAsync({
				itemId: item.id,
				lang: selectedLang,
				payload: {
					title: draft.title ?? item.translations?.[selectedLang]?.title ?? '',
					url_override: draft.url_override ?? item.translations?.[selectedLang]?.url_override ?? '',
				},
			});
			setToast({ tone: 'success', message: __('Menu item saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Menus', 'zentranslate')}
				description={__('Translate WordPress nav menu items per language.', 'zentranslate')}
			/>

			<div className="ztrans-mb-4 ztrans-flex ztrans-flex-wrap ztrans-gap-3">
				<Field label={__('Menu', 'zentranslate')}>
					<Select value={selectedMenu} onChange={(e) => setSelectedMenu(e.target.value)}>
						{(menus.data || []).map((m) => (
							<option key={m.id} value={m.id}>{m.name}</option>
						))}
					</Select>
				</Field>
				<Field label={__('Target language', 'zentranslate')}>
					<Select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
						{nonDefault.map((l) => (
							<option key={l.code} value={l.code}>{l.name}</option>
						))}
					</Select>
				</Field>
			</div>

			<Card padded={false}>
				{items.isLoading ? (
					<LoadingBlock>{__('Loading items…', 'zentranslate')}</LoadingBlock>
				) : (items.data || []).length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No menu items.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Original', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">
									{sprintf(/* translators: %s: language code. */ __('Translation (%s)', 'zentranslate'), selectedLang)}
								</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('URL override', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-24" />
							</tr>
						</thead>
						<tbody>
							{(items.data || []).map((item) => {
								const tr = item.translations?.[selectedLang] || {};
								const draft = drafts[item.id] || {};
								return (
									<tr key={item.id} className="ztrans-border-t ztrans-border-ztrans-border">
										<td className="ztrans-px-4 ztrans-py-3">
											<div className="ztrans-font-medium">{item.title}</div>
											<div className="ztrans-text-xs ztrans-text-ztrans-muted">{item.url}</div>
										</td>
										<td className="ztrans-px-4 ztrans-py-3">
											<TextInput
												value={draft.title ?? tr.title ?? ''}
												onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...(d[item.id] || {}), title: e.target.value } }))}
											/>
										</td>
										<td className="ztrans-px-4 ztrans-py-3">
											<TextInput
												value={draft.url_override ?? tr.url_override ?? ''}
												onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...(d[item.id] || {}), url_override: e.target.value } }))}
											/>
										</td>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
											<Button size="sm" onClick={() => onSave(item)} loading={save.isPending}>
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

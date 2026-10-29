import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { TextInput } from '../../components/Input';
import { Select } from '../../components/ui/Select';
import { PageSkeleton, TableSkeleton } from '../../components/Skeleton';
import { api, unwrap } from '../../lib/api';
import { useGetMenuItemsQuery, useSaveMenuItemMutation } from '../../lib/gtransApi';
import { setMenuPage } from '../../lib/store';
import { useQuery } from '@tanstack/react-query';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

function useMenus() {
	return useQuery({
		queryKey: ['menus'],
		queryFn: async () => unwrap(await api.get('menus')) || [],
	});
}

const PAGE_SIZE = 50;

export default function MenusPage() {
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default && l.active);
	const menus = useMenus();
	const [selectedMenu, setSelectedMenu] = useState('');
	const [selectedLang, setSelectedLang] = useState('');
	const dispatch = useDispatch();
	const page = useSelector((state) => state.menuItemsList.page);
	const items = useGetMenuItemsQuery({ menuId: selectedMenu, page, per_page: PAGE_SIZE }, { skip: !selectedMenu });
	const [saveItem, saveState] = useSaveMenuItemMutation();
	const rows = items.data?.rows || [];
	const total = items.data?.meta?.total || 0;
	const totalPages = items.data?.meta?.total_pages || 1;
	const currentPage = items.data?.meta?.page || page;
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!selectedMenu && menus.data?.length) setSelectedMenu(String(menus.data[0].id));
		if (!selectedLang && nonDefault.length) setSelectedLang(nonDefault[0].code);
	}, [menus.data, nonDefault, selectedMenu, selectedLang]);

	if (menus.isLoading || langs.isLoading) return <PageSkeleton />;

	const onSave = async (item) => {
		const draft = drafts[item.id] || {};
		try {
			await saveItem({
				itemId: item.id,
				lang: selectedLang,
				payload: {
					title: draft.title ?? item.translations?.[selectedLang]?.title ?? '',
					url_override: draft.url_override ?? item.translations?.[selectedLang]?.url_override ?? '',
				},
			}).unwrap();
			setDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; });
			setToast({ tone: 'success', message: __('Menu item saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Menus', 'gemtranslate')}
				description={__('Translate WordPress nav menu items per language.', 'gemtranslate')}
				actions={
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-end gtrans-gap-3">
						<label className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-xs gtrans-text-muted">
							{__('Menu', 'gemtranslate')}
							<Select
								className="gtrans-min-w-[180px]"
								value={selectedMenu}
								onChange={(e) => {
									setSelectedMenu(e.target.value);
									dispatch(setMenuPage(1));
								}}
							>
								{(menus.data || []).map((m) => (
									<option key={m.id} value={m.id}>{m.name}</option>
								))}
							</Select>
						</label>
						<label className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-xs gtrans-text-muted">
							{__('Language', 'gemtranslate')}
							<Select
								className="gtrans-min-w-[160px]"
								value={selectedLang}
								onChange={(e) => setSelectedLang(e.target.value)}
							>
								{nonDefault.map((l) => (
									<option key={l.code} value={l.code}>{l.name}</option>
								))}
							</Select>
						</label>
					</div>
				}
			/>

			<Card table>
				{items.isLoading ? (
					<TableSkeleton />
				) : rows.length === 0 ? (
					<Table.Empty columns={[__('Original', 'gemtranslate'), __('Translation', 'gemtranslate'), __('URL override', 'gemtranslate'), '']}>
						{__('No menu items.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>{__('Original', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>
									{sprintf(/* translators: %s: language code. */ __('Translation (%s)', 'gemtranslate'), selectedLang)}
								</Table.ColumnHeader>
								<Table.ColumnHeader>{__('URL override', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader className="gtrans-w-24" />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((item) => {
								const tr = item.translations?.[selectedLang] || {};
								const draft = drafts[item.id] || {};
								return (
									<Table.Row key={item.id}>
										<Table.Cell>
											<div className="gtrans-font-medium">{item.title}</div>
											<div className="gtrans-text-xs gtrans-text-muted">{item.url}</div>
										</Table.Cell>
										<Table.Cell>
											<TextInput
												value={draft.title ?? tr.title ?? ''}
												onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...(d[item.id] || {}), title: e.target.value } }))}
											/>
										</Table.Cell>
										<Table.Cell>
											<TextInput
												value={draft.url_override ?? tr.url_override ?? ''}
												onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...(d[item.id] || {}), url_override: e.target.value } }))}
											/>
										</Table.Cell>
										<Table.Cell className="gtrans-text-right">
											<Button size="sm" onClick={() => onSave(item)} loading={saveState.isLoading}>
												{__('Save', 'gemtranslate')}
											</Button>
										</Table.Cell>
									</Table.Row>
								);
							})}
						</Table.Body>
					</Table.Root>
				)}

				{total > PAGE_SIZE && (
					<div className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-mt-3 gtrans-text-sm">
						<span className="gtrans-text-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages, 3: total rows. */
								__('Page %1$d of %2$d · %3$d total', 'gemtranslate'),
								currentPage,
								totalPages,
								total
							)}
						</span>
						<div className="gtrans-flex gtrans-gap-2">
							<Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => dispatch(setMenuPage(currentPage - 1))}>
								{__('Previous', 'gemtranslate')}
							</Button>
							<Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => dispatch(setMenuPage(currentPage + 1))}>
								{__('Next', 'gemtranslate')}
							</Button>
						</div>
					</div>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

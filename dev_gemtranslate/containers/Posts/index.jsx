import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import { Checkbox } from '../../components/Input';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';
import { Table } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/Skeleton';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { hasFeature } from '../../hooks/useFeatures';
import { usePosts } from '../../hooks/usePosts';
import { useLanguages } from '../../hooks/useLanguages';
import { useBulkTranslate } from '../../hooks/useJobs';
import { formatErrorMessage, truncate } from '../../lib/format';

const STATUS_TONE = {
	publish: 'publish',
	translated: 'translated',
	pending: 'pending',
	draft: 'draft',
	stale: 'draft',
};

export default function PostsPage() {
	const [filters, setFilters] = useState({ page: 1, per_page: 20, search: '', status: 'any' });
	// Post type is chosen from the sidebar submenu (?type=page).
	const [params] = useSearchParams();
	const postType = params.get('type') || 'post';
	const query = useMemo(() => ({ ...filters, post_type: postType }), [filters, postType]);
	const posts = usePosts(query);
	const languages = useLanguages();
	const bulk = useBulkTranslate();
	const langs = languages.data || [];
	const nonDefault = langs.filter((l) => !l.is_default && l.active);

	const [selectedIds, setSelectedIds] = useState([]);
	const [selectedLangs, setSelectedLangs] = useState([]);
	const [overwrite, setOverwrite] = useState(false);
	const [toast, setToast] = useState(null);

	// Switching post type starts a fresh list.
	useEffect(() => {
		setFilters((f) => ({ ...f, page: 1 }));
		setSelectedIds([]);
	}, [postType]);

	// Default selected langs to all non-default whenever language list changes.
	useEffect(() => {
		if (selectedLangs.length === 0 && nonDefault.length) {
			setSelectedLangs(nonDefault.map((l) => l.code));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [languages.data]);

	const visibleIds = useMemo(() => (posts.data?.rows || []).map((r) => r.id), [posts.data]);
	const allVisibleSelected =
		visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

	const toggleSelectAll = () => {
		setSelectedIds((s) =>
			allVisibleSelected
				? s.filter((id) => !visibleIds.includes(id))
				: Array.from(new Set([...s, ...visibleIds]))
		);
	};
	const toggleOne = (id) =>
		setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

	const toggleLang = (code) =>
		setSelectedLangs((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));

	const runBulk = async () => {
		if (selectedIds.length === 0 || selectedLangs.length === 0) return;
		try {
			const result = await bulk.mutateAsync({
				post_ids: selectedIds,
				languages: selectedLangs,
				options: { use_memory: true, preserve_html: true, overwrite },
			});
			setSelectedIds([]);
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: %d: number of jobs queued. */
					__('%d translation jobs queued. See Jobs page for progress.', 'gemtranslate'),
					result.queued
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Posts & Pages', 'gemtranslate')}
				description={__(
					'Pick a post to translate it into your active languages, or bulk-translate with AI.',
					'gemtranslate'
				)}
			/>

			<Card table>
				<Table.Toolbar variant="tabs">
					<StatusTabs
						value={filters.status}
						onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
						tabs={[
							{ value: 'any', label: __('All', 'gemtranslate') },
							{ value: 'publish', label: __('Published', 'gemtranslate') },
							{ value: 'draft', label: __('Draft', 'gemtranslate') },
							{ value: 'pending', label: __('Pending', 'gemtranslate') },
							{ value: 'private', label: __('Private', 'gemtranslate') },
						]}
					/>
					<SearchBox
						value={filters.search}
						placeholder={__('Search by title…', 'gemtranslate')}
						onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
					/>
				</Table.Toolbar>

				{selectedIds.length > 0 && hasFeature('ai_bulk') && (
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-mb-4 gtrans-rounded gtrans-bg-primary-light gtrans-px-4 gtrans-py-3 gtrans-text-sm">
						<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
							<strong>
								{sprintf(
									/* translators: %d: number of selected posts. */
									__('%d selected', 'gemtranslate'),
									selectedIds.length
								)}
							</strong>
							<div className="gtrans-flex gtrans-gap-2">
								{nonDefault.map((l) => (
									<Checkbox
										key={l.code}
										label={l.code}
										checked={selectedLangs.includes(l.code)}
										onChange={() => toggleLang(l.code)}
									/>
								))}
							</div>
							<Checkbox
								label={__('Overwrite existing', 'gemtranslate')}
								checked={overwrite}
								onChange={(e) => setOverwrite(e.target.checked)}
							/>
						</div>
						<div className="gtrans-flex gtrans-gap-2">
							<Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
								{__('Clear', 'gemtranslate')}
							</Button>
							<Button
								size="sm"
								onClick={runBulk}
								loading={bulk.isPending}
								disabled={selectedLangs.length === 0}
							>
								{__('Translate selected with AI', 'gemtranslate')}
							</Button>
						</div>
					</div>
				)}

				{posts.isLoading ? (
					<TableSkeleton />
				) : posts.data?.rows.length === 0 ? (
					<Table.Empty columns={['', __('Title', 'gemtranslate'), __('Status', 'gemtranslate'), '']}>
						{__('No posts found.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.ScrollArea>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.ColumnHeader className="gtrans-w-10">
										<input
											type="checkbox"
											checked={allVisibleSelected}
											onChange={toggleSelectAll}
											aria-label={__('Select all visible', 'gemtranslate')}
										/>
									</Table.ColumnHeader>
									<Table.ColumnHeader>{__('Title', 'gemtranslate')}</Table.ColumnHeader>
									<Table.ColumnHeader>{__('Status', 'gemtranslate')}</Table.ColumnHeader>
									{nonDefault.map((l) => (
										<Table.ColumnHeader key={l.code}>{l.code.toUpperCase()}</Table.ColumnHeader>
									))}
									<Table.ColumnHeader />
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{(posts.data?.rows || []).map((row) => (
									<Table.Row key={row.id}>
										<Table.Cell>
											<input
												type="checkbox"
												checked={selectedIds.includes(row.id)}
												onChange={() => toggleOne(row.id)}
												aria-label={`Select post ${row.id}`}
											/>
										</Table.Cell>
										<Table.Cell className="gtrans-max-w-[360px]">
											<div className="gtrans-font-medium gtrans-text-ink">
												{truncate(row.title, 60)}
											</div>
											<div className="gtrans-text-xs gtrans-text-muted">/{row.slug}</div>
										</Table.Cell>
										<Table.Cell>
											<StatusPill tone={STATUS_TONE[row.status] || 'none'}>{row.status}</StatusPill>
										</Table.Cell>
										{nonDefault.map((l) => {
											const status = row.translations_status?.[l.code];
											return (
												<Table.Cell key={l.code}>
													{status ? (
														<StatusPill tone={STATUS_TONE[status] || 'pending'}>
															{status === 'stale' ? __('stale', 'gemtranslate') : status}
														</StatusPill>
													) : (
														<StatusPill tone="none">—</StatusPill>
													)}
												</Table.Cell>
											);
										})}
										<Table.Cell className="gtrans-text-right">
											<Button as={Link} to={`/posts/${row.id}`} variant="primary" size="sm">
												{__('Translate', 'gemtranslate')}
											</Button>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Root>
					</Table.ScrollArea>
				)}

				{!posts.isLoading && (posts.data?.rows || []).length > 0 && (
					<Table.Footer>
						<span className="gtrans-text-muted">
							{sprintf(
								/* translators: 1: rows shown, 2: total rows. */
								__('Showing result %1$d out of %2$d', 'gemtranslate'),
								posts.data.rows.length,
								posts.data.meta?.total ?? posts.data.rows.length
							)}
						</span>
						{posts.data.meta?.total_pages > 1 && (
							<div className="gtrans-flex gtrans-items-center gtrans-gap-3">
								<span className="gtrans-text-muted">
									{sprintf(
										/* translators: 1: current page, 2: total pages. */
										__('Page %1$d of %2$d', 'gemtranslate'),
										filters.page,
										posts.data.meta.total_pages
									)}
								</span>
								<Button
									variant="secondary"
									size="sm"
									disabled={filters.page <= 1}
									onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
								>
									{__('Previous', 'gemtranslate')}
								</Button>
								<Button
									variant="secondary"
									size="sm"
									disabled={filters.page >= posts.data.meta.total_pages}
									onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
								>
									{__('Next', 'gemtranslate')}
								</Button>
							</div>
						)}
					</Table.Footer>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

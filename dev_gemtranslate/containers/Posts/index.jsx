import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';
import { Table } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/Skeleton';
import Button from '../../components/Button';
import { usePosts } from '../../hooks/usePosts';
import { useLanguages } from '../../hooks/useLanguages';
import { truncate } from '../../lib/format';

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
	const langs = languages.data || [];
	const nonDefault = langs.filter((l) => !l.is_default && l.active);

	// Switching post type starts a fresh list.
	useEffect(() => {
		setFilters((f) => ({ ...f, page: 1 }));
	}, [postType]);

	return (
		<>
			<PageHeader
				title={__('Posts & Pages', 'gemtranslate')}
				description={__('Pick a post to translate it into your active languages.', 'gemtranslate')}
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

				{posts.isLoading ? (
					<TableSkeleton />
				) : posts.data?.rows.length === 0 ? (
					<Table.Empty columns={[__('Title', 'gemtranslate'), __('Status', 'gemtranslate'), '']}>
						{__('No posts found.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.ScrollArea>
						<Table.Root>
							<Table.Header>
								<Table.Row>
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
		</>
	);
}

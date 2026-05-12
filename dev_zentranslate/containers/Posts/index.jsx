import { useState } from 'react';
import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import { Field, Select, TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import Button from '../../components/Button';
import { usePosts } from '../../hooks/usePosts';
import { useLanguages } from '../../hooks/useLanguages';
import { truncate } from '../../lib/format';

export default function PostsPage() {
	const [filters, setFilters] = useState({ post_type: 'post', page: 1, per_page: 20, search: '' });
	const [search, setSearch] = useState('');
	const posts = usePosts(filters);
	const languages = useLanguages();
	const langs = languages.data || [];
	const nonDefault = langs.filter((l) => !l.is_default);

	const runSearch = (e) => {
		e.preventDefault();
		setFilters((f) => ({ ...f, search, page: 1 }));
	};

	return (
		<>
			<PageHeader
				title={__('Posts & Pages', 'zentranslate')}
				description={__('Pick a post to translate it into your active languages.', 'zentranslate')}
			/>

			<Card padded={false}>
				<form onSubmit={runSearch} className="ztrans-flex ztrans-flex-wrap ztrans-items-end ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3">
					<div className="ztrans-min-w-[160px]">
						<Field label={__('Post type', 'zentranslate')}>
							<Select value={filters.post_type} onChange={(e) => setFilters((f) => ({ ...f, post_type: e.target.value, page: 1 }))}>
								<option value="post">{__('Posts', 'zentranslate')}</option>
								<option value="page">{__('Pages', 'zentranslate')}</option>
								<option value="product">{__('Products (Woo)', 'zentranslate')}</option>
							</Select>
						</Field>
					</div>
					<div className="ztrans-min-w-[200px] ztrans-flex-1">
						<Field label={__('Search', 'zentranslate')}>
							<TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={__('Search by title…', 'zentranslate')} />
						</Field>
					</div>
					<Button type="submit" variant="secondary">{__('Filter', 'zentranslate')}</Button>
				</form>

				{posts.isLoading ? (
					<LoadingBlock>{__('Loading posts…', 'zentranslate')}</LoadingBlock>
				) : posts.data?.rows.length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No posts found.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Title', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Status', 'zentranslate')}</th>
								{nonDefault.map((l) => (
									<th key={l.code} className="ztrans-px-4 ztrans-py-3">{l.code.toUpperCase()}</th>
								))}
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(posts.data?.rows || []).map((row) => (
								<tr key={row.id} className="ztrans-border-t ztrans-border-ztrans-border">
									<td className="ztrans-px-4 ztrans-py-3 ztrans-max-w-[360px]">
										<div className="ztrans-font-medium ztrans-text-gray-900">{truncate(row.title, 60)}</div>
										<div className="ztrans-text-xs ztrans-text-ztrans-muted">/{row.slug}</div>
									</td>
									<td className="ztrans-px-4 ztrans-py-3">
										<StatusPill tone={row.status === 'publish' ? 'publish' : 'draft'}>{row.status}</StatusPill>
									</td>
									{nonDefault.map((l) => {
										const status = row.translations_status?.[l.code];
										return (
											<td key={l.code} className="ztrans-px-4 ztrans-py-3">
												{status ? (
													<StatusPill tone={status === 'publish' ? 'translated' : 'pending'}>{status}</StatusPill>
												) : (
													<StatusPill tone="none">—</StatusPill>
												)}
											</td>
										);
									})}
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
										<Link to={`/posts/${row.id}`} className="ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-3 ztrans-py-1.5 ztrans-text-xs ztrans-text-white ztrans-no-underline">
											{__('Translate', 'zentranslate')}
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{posts.data?.meta?.total_pages > 1 && (
					<div className="ztrans-flex ztrans-justify-between ztrans-border-t ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm">
						<span className="ztrans-text-ztrans-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages. */
								__('Page %1$d of %2$d', 'zentranslate'),
								filters.page,
								posts.data.meta.total_pages
							)}
						</span>
						<div className="ztrans-flex ztrans-gap-2">
							<Button variant="ghost" size="sm" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
								{__('Previous', 'zentranslate')}
							</Button>
							<Button variant="ghost" size="sm" disabled={filters.page >= posts.data.meta.total_pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
								{__('Next', 'zentranslate')}
							</Button>
						</div>
					</div>
				)}
			</Card>
		</>
	);
}

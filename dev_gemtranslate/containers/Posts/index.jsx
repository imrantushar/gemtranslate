import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import { Field, Select, TextInput, Checkbox } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { hasFeature } from '../../hooks/useFeatures';
import { usePosts } from '../../hooks/usePosts';
import { useLanguages } from '../../hooks/useLanguages';
import { usePostTypes } from '../../hooks/usePostTypes';
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
	const [filters, setFilters] = useState({ post_type: 'post', page: 1, per_page: 20, search: '' });
	const [search, setSearch] = useState('');
	const posts = usePosts(filters);
	const languages = useLanguages();
	const postTypes = usePostTypes();
	const bulk = useBulkTranslate();
	const langs = languages.data || [];
	const nonDefault = langs.filter((l) => !l.is_default && l.active);
	const types = postTypes.data || [];

	const [selectedIds, setSelectedIds] = useState([]);
	const [selectedLangs, setSelectedLangs] = useState([]);
	const [overwrite, setOverwrite] = useState(false);
	const [toast, setToast] = useState(null);

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

	const runSearch = (e) => {
		e.preventDefault();
		setFilters((f) => ({ ...f, search, page: 1 }));
	};

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

			<Card padded={false}>
				<form
					onSubmit={runSearch}
					className="gtrans-flex gtrans-flex-wrap gtrans-items-end gtrans-gap-3 gtrans-border-b gtrans-border-gtrans-border gtrans-px-4 gtrans-py-3"
				>
					<div className="gtrans-min-w-[160px]">
						<Field label={__('Post type', 'gemtranslate')}>
							<Select
								value={filters.post_type}
								onChange={(e) => setFilters((f) => ({ ...f, post_type: e.target.value, page: 1 }))}
							>
								{types.length === 0 ? (
									<>
										<option value="post">{__('Posts', 'gemtranslate')}</option>
										<option value="page">{__('Pages', 'gemtranslate')}</option>
									</>
								) : (
									types.map((t) => (
										<option key={t.name} value={t.name}>
											{t.label}
										</option>
									))
								)}
							</Select>
						</Field>
					</div>
					<div className="gtrans-min-w-[200px] gtrans-flex-1">
						<Field label={__('Search', 'gemtranslate')}>
							<TextInput
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder={__('Search by title…', 'gemtranslate')}
							/>
						</Field>
					</div>
					<Button type="submit" variant="secondary">
						{__('Filter', 'gemtranslate')}
					</Button>
				</form>

				{selectedIds.length > 0 && hasFeature('ai_bulk') && (
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-border-b gtrans-border-gtrans-border gtrans-bg-blue-50 gtrans-px-4 gtrans-py-3 gtrans-text-sm">
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
					<LoadingBlock>{__('Loading posts…', 'gemtranslate')}</LoadingBlock>
				) : posts.data?.rows.length === 0 ? (
					<p className="gtrans-px-5 gtrans-py-8 gtrans-text-center gtrans-text-sm gtrans-text-gtrans-muted">
						{__('No posts found.', 'gemtranslate')}
					</p>
				) : (
					<table className="gtrans-w-full gtrans-text-sm">
						<thead className="gtrans-bg-gtrans-bg gtrans-text-left gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
							<tr>
								<th className="gtrans-px-4 gtrans-py-3 gtrans-w-10">
									<input
										type="checkbox"
										checked={allVisibleSelected}
										onChange={toggleSelectAll}
										aria-label={__('Select all visible', 'gemtranslate')}
									/>
								</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Title', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Status', 'gemtranslate')}</th>
								{nonDefault.map((l) => (
									<th key={l.code} className="gtrans-px-4 gtrans-py-3">
										{l.code.toUpperCase()}
									</th>
								))}
								<th className="gtrans-px-4 gtrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(posts.data?.rows || []).map((row) => (
								<tr key={row.id} className="gtrans-border-t gtrans-border-gtrans-border">
									<td className="gtrans-px-4 gtrans-py-3">
										<input
											type="checkbox"
											checked={selectedIds.includes(row.id)}
											onChange={() => toggleOne(row.id)}
											aria-label={`Select post ${row.id}`}
										/>
									</td>
									<td className="gtrans-px-4 gtrans-py-3 gtrans-max-w-[360px]">
										<div className="gtrans-font-medium gtrans-text-gray-900">
											{truncate(row.title, 60)}
										</div>
										<div className="gtrans-text-xs gtrans-text-gtrans-muted">/{row.slug}</div>
									</td>
									<td className="gtrans-px-4 gtrans-py-3">
										<StatusPill tone={STATUS_TONE[row.status] || 'none'}>{row.status}</StatusPill>
									</td>
									{nonDefault.map((l) => {
										const status = row.translations_status?.[l.code];
										return (
											<td key={l.code} className="gtrans-px-4 gtrans-py-3">
												{status ? (
													<StatusPill tone={STATUS_TONE[status] || 'pending'}>
														{status === 'stale' ? __('stale', 'gemtranslate') : status}
													</StatusPill>
												) : (
													<StatusPill tone="none">—</StatusPill>
												)}
											</td>
										);
									})}
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-right">
										<Link
											to={`/posts/${row.id}`}
											className="gtrans-rounded-md gtrans-bg-gtrans-primary gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-text-white gtrans-no-underline"
										>
											{__('Translate', 'gemtranslate')}
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{posts.data?.meta?.total_pages > 1 && (
					<div className="gtrans-flex gtrans-justify-between gtrans-border-t gtrans-border-gtrans-border gtrans-px-4 gtrans-py-3 gtrans-text-sm">
						<span className="gtrans-text-gtrans-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages. */
								__('Page %1$d of %2$d', 'gemtranslate'),
								filters.page,
								posts.data.meta.total_pages
							)}
						</span>
						<div className="gtrans-flex gtrans-gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={filters.page <= 1}
								onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
							>
								{__('Previous', 'gemtranslate')}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={filters.page >= posts.data.meta.total_pages}
								onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
							>
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

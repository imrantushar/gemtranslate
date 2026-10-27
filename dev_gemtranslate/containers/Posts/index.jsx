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
					className="ztrans-flex ztrans-flex-wrap ztrans-items-end ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3"
				>
					<div className="ztrans-min-w-[160px]">
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
					<div className="ztrans-min-w-[200px] ztrans-flex-1">
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
					<div className="ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-justify-between ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-bg-blue-50 ztrans-px-4 ztrans-py-3 ztrans-text-sm">
						<div className="ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-3">
							<strong>
								{sprintf(
									/* translators: %d: number of selected posts. */
									__('%d selected', 'gemtranslate'),
									selectedIds.length
								)}
							</strong>
							<div className="ztrans-flex ztrans-gap-2">
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
						<div className="ztrans-flex ztrans-gap-2">
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
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No posts found.', 'gemtranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-w-10">
									<input
										type="checkbox"
										checked={allVisibleSelected}
										onChange={toggleSelectAll}
										aria-label={__('Select all visible', 'gemtranslate')}
									/>
								</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Title', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Status', 'gemtranslate')}</th>
								{nonDefault.map((l) => (
									<th key={l.code} className="ztrans-px-4 ztrans-py-3">
										{l.code.toUpperCase()}
									</th>
								))}
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(posts.data?.rows || []).map((row) => (
								<tr key={row.id} className="ztrans-border-t ztrans-border-ztrans-border">
									<td className="ztrans-px-4 ztrans-py-3">
										<input
											type="checkbox"
											checked={selectedIds.includes(row.id)}
											onChange={() => toggleOne(row.id)}
											aria-label={`Select post ${row.id}`}
										/>
									</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-max-w-[360px]">
										<div className="ztrans-font-medium ztrans-text-gray-900">
											{truncate(row.title, 60)}
										</div>
										<div className="ztrans-text-xs ztrans-text-ztrans-muted">/{row.slug}</div>
									</td>
									<td className="ztrans-px-4 ztrans-py-3">
										<StatusPill tone={STATUS_TONE[row.status] || 'none'}>{row.status}</StatusPill>
									</td>
									{nonDefault.map((l) => {
										const status = row.translations_status?.[l.code];
										return (
											<td key={l.code} className="ztrans-px-4 ztrans-py-3">
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
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
										<Link
											to={`/posts/${row.id}`}
											className="ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-3 ztrans-py-1.5 ztrans-text-xs ztrans-text-white ztrans-no-underline"
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
					<div className="ztrans-flex ztrans-justify-between ztrans-border-t ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm">
						<span className="ztrans-text-ztrans-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages. */
								__('Page %1$d of %2$d', 'gemtranslate'),
								filters.page,
								posts.data.meta.total_pages
							)}
						</span>
						<div className="ztrans-flex ztrans-gap-2">
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

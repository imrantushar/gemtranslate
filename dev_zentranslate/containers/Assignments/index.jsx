import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, Select, TextInput, TextArea } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import {
	useAssignments,
	useCreateAssignment,
	useUpdateAssignment,
	useDeleteAssignment,
} from '../../hooks/useAssignments';
import { usePosts } from '../../hooks/usePosts';
import { usePostTypes } from '../../hooks/usePostTypes';
import { useLanguages } from '../../hooks/useLanguages';
import { useTranslators } from '../../hooks/useTranslators';
import { formatErrorMessage, truncate } from '../../lib/format';

const canManage = !!(
	window.ztrans &&
	window.ztrans.currentUser &&
	window.ztrans.currentUser.canManage
);

const STATUS_TONE = {
	assigned: 'pending',
	in_progress: 'draft',
	completed: 'translated',
	cancelled: 'none',
};
const statusLabel = (s) =>
	({
		assigned: __('Assigned', 'zentranslate'),
		in_progress: __('In progress', 'zentranslate'),
		completed: __('Completed', 'zentranslate'),
		cancelled: __('Cancelled', 'zentranslate'),
	})[s] || s;

export default function AssignmentsPage() {
	const [scope, setScope] = useState(canManage ? 'all' : 'mine');
	const [status, setStatus] = useState('');
	const params = useMemo(() => ({ scope, ...(status ? { status } : {}) }), [scope, status]);
	const list = useAssignments(params);
	const update = useUpdateAssignment();
	const remove = useDeleteAssignment();
	const [toast, setToast] = useState(null);

	const rows = list.data?.rows || [];

	const act = async (fn, okMsg) => {
		try {
			await fn();
			if (okMsg) setToast({ tone: 'success', message: okMsg });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Assignments', 'zentranslate')}
				description={
					canManage
						? __('Assign posts to translators and track their progress.', 'zentranslate')
						: __(
								'Translation work assigned to you. Open a post to translate it, then mark it complete.',
								'zentranslate'
						  )
				}
			/>

			{canManage && <NewAssignment onToast={setToast} />}

			<Card padded={false}>
				<div className="ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm">
					{canManage && (
						<div className="ztrans-flex ztrans-gap-1">
							{['all', 'mine'].map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setScope(s)}
									className={`ztrans-bare ztrans-rounded-md ztrans-px-3 ztrans-py-1 ztrans-text-xs ${
										scope === s
											? 'ztrans-bg-ztrans-primary ztrans-text-white'
											: 'ztrans-bg-white ztrans-border ztrans-border-ztrans-border ztrans-text-gray-700'
									}`}
								>
									{s === 'all'
										? __('Everyone', 'zentranslate')
										: __('Assigned by me', 'zentranslate')}
								</button>
							))}
						</div>
					)}
					<div className="ztrans-min-w-[160px]">
						<Select value={status} onChange={(e) => setStatus(e.target.value)}>
							<option value="">{__('All statuses', 'zentranslate')}</option>
							<option value="open">{__('Open', 'zentranslate')}</option>
							<option value="assigned">{__('Assigned', 'zentranslate')}</option>
							<option value="in_progress">{__('In progress', 'zentranslate')}</option>
							<option value="completed">{__('Completed', 'zentranslate')}</option>
							<option value="cancelled">{__('Cancelled', 'zentranslate')}</option>
						</Select>
					</div>
				</div>

				{list.isLoading ? (
					<LoadingBlock>{__('Loading assignments…', 'zentranslate')}</LoadingBlock>
				) : rows.length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-10 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No assignments yet.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Content', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Language', 'zentranslate')}</th>
								{canManage && (
									<th className="ztrans-px-4 ztrans-py-3">{__('Translator', 'zentranslate')}</th>
								)}
								<th className="ztrans-px-4 ztrans-py-3">{__('Status', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
									{__('Actions', 'zentranslate')}
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id} className="ztrans-border-t ztrans-border-ztrans-border">
									<td className="ztrans-px-4 ztrans-py-3 ztrans-max-w-[280px]">
										<div className="ztrans-font-medium ztrans-text-gray-900">
											{truncate(r.post_title, 60)}
										</div>
										{r.note && (
											<div className="ztrans-text-xs ztrans-text-ztrans-muted">
												{truncate(r.note, 80)}
											</div>
										)}
									</td>
									<td className="ztrans-px-4 ztrans-py-3">
										{r.language_name}
										{r.country_code ? ` · ${r.country_code}` : ''}
									</td>
									{canManage && <td className="ztrans-px-4 ztrans-py-3">{r.translator_name}</td>}
									<td className="ztrans-px-4 ztrans-py-3">
										<StatusPill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</StatusPill>
									</td>
									<td className="ztrans-px-4 ztrans-py-3">
										<div className="ztrans-flex ztrans-items-center ztrans-justify-end ztrans-gap-2">
											<Link
												to={`/posts/${r.post_id}`}
												className="ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-px-3 ztrans-py-1.5 ztrans-text-xs ztrans-text-gray-700 ztrans-no-underline hover:ztrans-bg-gray-50"
											>
												{__('Open', 'zentranslate')}
											</Link>
											{!canManage && r.status === 'assigned' && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() =>
														act(() => update.mutateAsync({ id: r.id, status: 'in_progress' }))
													}
												>
													{__('Start', 'zentranslate')}
												</Button>
											)}
											{!canManage && (r.status === 'assigned' || r.status === 'in_progress') && (
												<Button
													size="sm"
													onClick={() =>
														act(
															() => update.mutateAsync({ id: r.id, status: 'completed' }),
															__('Marked complete.', 'zentranslate')
														)
													}
												>
													{__('Complete', 'zentranslate')}
												</Button>
											)}
											{canManage && r.status !== 'cancelled' && r.status !== 'completed' && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() =>
														act(() => update.mutateAsync({ id: r.id, status: 'cancelled' }))
													}
												>
													{__('Cancel', 'zentranslate')}
												</Button>
											)}
											{canManage && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() => act(() => remove.mutateAsync(r.id))}
												>
													{__('Delete', 'zentranslate')}
												</Button>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

/** Manager-only: assign a post + language to a translator. */
function NewAssignment({ onToast }) {
	const postTypes = usePostTypes();
	const [postType, setPostType] = useState('post');
	const [search, setSearch] = useState('');
	const posts = usePosts({ post_type: postType, per_page: 20, search });
	const languages = useLanguages();
	const translators = useTranslators();
	const create = useCreateAssignment();

	const [postId, setPostId] = useState('');
	const [lang, setLang] = useState('');
	const [translatorId, setTranslatorId] = useState('');
	const [note, setNote] = useState('');

	const nonDefault = (languages.data || []).filter((l) => !l.is_default && l.active);
	const postRows = posts.data?.rows || [];
	const types = postTypes.data || [];

	const submit = async () => {
		if (!postId || !lang || !translatorId) {
			onToast({
				tone: 'error',
				message: __('Pick a post, language and translator.', 'zentranslate'),
			});
			return;
		}
		try {
			await create.mutateAsync({
				post_id: Number(postId),
				language_code: lang,
				translator_id: Number(translatorId),
				note,
			});
			setPostId('');
			setNote('');
			onToast({
				tone: 'success',
				message: __('Assignment created and the translator notified.', 'zentranslate'),
			});
		} catch (err) {
			onToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<Card title={__('New assignment', 'zentranslate')} className="ztrans-mb-6">
			<div className="ztrans-grid ztrans-gap-3 md:ztrans-grid-cols-2">
				<Field label={__('Post type', 'zentranslate')}>
					<Select
						value={postType}
						onChange={(e) => {
							setPostType(e.target.value);
							setPostId('');
						}}
					>
						{types.length === 0 ? (
							<>
								<option value="post">{__('Posts', 'zentranslate')}</option>
								<option value="page">{__('Pages', 'zentranslate')}</option>
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
				<Field label={__('Search content', 'zentranslate')}>
					<TextInput
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={__('Filter by title…', 'zentranslate')}
					/>
				</Field>
				<Field label={__('Content', 'zentranslate')}>
					<Select value={postId} onChange={(e) => setPostId(e.target.value)}>
						<option value="">{__('— Pick content —', 'zentranslate')}</option>
						{postRows.map((p) => (
							<option key={p.id} value={p.id}>
								{truncate(p.title, 70)}
							</option>
						))}
					</Select>
				</Field>
				<Field label={__('Language', 'zentranslate')}>
					<Select value={lang} onChange={(e) => setLang(e.target.value)}>
						<option value="">{__('— Pick language —', 'zentranslate')}</option>
						{nonDefault.map((l) => (
							<option key={l.code} value={l.code}>
								{l.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label={__('Translator', 'zentranslate')}>
					<Select value={translatorId} onChange={(e) => setTranslatorId(e.target.value)}>
						<option value="">{__('— Pick translator —', 'zentranslate')}</option>
						{(translators.data || []).map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label={__('Note (optional)', 'zentranslate')}>
					<TextArea
						rows={2}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder={__('Instructions for the translator…', 'zentranslate')}
					/>
				</Field>
			</div>
			<div className="ztrans-mt-4 ztrans-flex ztrans-justify-end">
				<Button onClick={submit} loading={create.isPending}>
					{__('Assign & notify', 'zentranslate')}
				</Button>
			</div>
		</Card>
	);
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, TextInput, TextArea } from '../../components/Input';
import { Select } from '../../components/ui/Select';
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
	window.gtrans &&
	window.gtrans.currentUser &&
	window.gtrans.currentUser.canManage
);

const STATUS_TONE = {
	assigned: 'pending',
	in_progress: 'draft',
	completed: 'translated',
	cancelled: 'none',
};
const statusLabel = (s) =>
	({
		assigned: __('Assigned', 'gemtranslate'),
		in_progress: __('In progress', 'gemtranslate'),
		completed: __('Completed', 'gemtranslate'),
		cancelled: __('Cancelled', 'gemtranslate'),
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
				title={__('Assignments', 'gemtranslate')}
				description={
					canManage
						? __('Assign posts to translators and track their progress.', 'gemtranslate')
						: __(
								'Translation work assigned to you. Open a post to translate it, then mark it complete.',
								'gemtranslate'
						  )
				}
			/>

			{canManage && <NewAssignment onToast={setToast} />}

			<Card padded={false}>
				<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3 gtrans-border-b gtrans-border-line gtrans-px-4 gtrans-py-3 gtrans-text-sm">
					{canManage && (
						<div className="gtrans-flex gtrans-gap-1">
							{['all', 'mine'].map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setScope(s)}
									className={`gtrans-bare gtrans-rounded-md gtrans-px-3 gtrans-py-1 gtrans-text-xs ${
										scope === s
											? 'gtrans-bg-primary gtrans-text-white'
											: 'gtrans-bg-surface gtrans-border gtrans-border-line gtrans-text-label'
									}`}
								>
									{s === 'all'
										? __('Everyone', 'gemtranslate')
										: __('Assigned by me', 'gemtranslate')}
								</button>
							))}
						</div>
					)}
					<div className="gtrans-min-w-[160px]">
						<Select value={status} onChange={(e) => setStatus(e.target.value)}>
							<option value="">{__('All statuses', 'gemtranslate')}</option>
							<option value="open">{__('Open', 'gemtranslate')}</option>
							<option value="assigned">{__('Assigned', 'gemtranslate')}</option>
							<option value="in_progress">{__('In progress', 'gemtranslate')}</option>
							<option value="completed">{__('Completed', 'gemtranslate')}</option>
							<option value="cancelled">{__('Cancelled', 'gemtranslate')}</option>
						</Select>
					</div>
				</div>

				{list.isLoading ? (
					<LoadingBlock>{__('Loading assignments…', 'gemtranslate')}</LoadingBlock>
				) : rows.length === 0 ? (
					<p className="gtrans-px-5 gtrans-py-10 gtrans-text-center gtrans-text-sm gtrans-text-muted">
						{__('No assignments yet.', 'gemtranslate')}
					</p>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>{__('Content', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Language', 'gemtranslate')}</Table.ColumnHeader>
								{canManage && (
									<Table.ColumnHeader>{__('Translator', 'gemtranslate')}</Table.ColumnHeader>
								)}
								<Table.ColumnHeader>{__('Status', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader className="gtrans-text-right">
									{__('Actions', 'gemtranslate')}
								</Table.ColumnHeader>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((r) => (
								<Table.Row key={r.id}>
									<Table.Cell className="gtrans-max-w-[280px]">
										<div className="gtrans-font-medium gtrans-text-ink">
											{truncate(r.post_title, 60)}
										</div>
										{r.note && (
											<div className="gtrans-text-xs gtrans-text-muted">
												{truncate(r.note, 80)}
											</div>
										)}
									</Table.Cell>
									<Table.Cell>
										{r.language_name}
										{r.country_code ? ` · ${r.country_code}` : ''}
									</Table.Cell>
									{canManage && <Table.Cell>{r.translator_name}</Table.Cell>}
									<Table.Cell>
										<StatusPill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</StatusPill>
									</Table.Cell>
									<Table.Cell>
										<div className="gtrans-flex gtrans-items-center gtrans-justify-end gtrans-gap-2">
											<Link
												to={`/posts/${r.post_id}`}
												className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-text-label gtrans-no-underline hover:gtrans-bg-body"
											>
												{__('Open', 'gemtranslate')}
											</Link>
											{!canManage && r.status === 'assigned' && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() =>
														act(() => update.mutateAsync({ id: r.id, status: 'in_progress' }))
													}
												>
													{__('Start', 'gemtranslate')}
												</Button>
											)}
											{!canManage && (r.status === 'assigned' || r.status === 'in_progress') && (
												<Button
													size="sm"
													onClick={() =>
														act(
															() => update.mutateAsync({ id: r.id, status: 'completed' }),
															__('Marked complete.', 'gemtranslate')
														)
													}
												>
													{__('Complete', 'gemtranslate')}
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
													{__('Cancel', 'gemtranslate')}
												</Button>
											)}
											{canManage && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() => act(() => remove.mutateAsync(r.id))}
												>
													{__('Delete', 'gemtranslate')}
												</Button>
											)}
										</div>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
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
				message: __('Pick a post, language and translator.', 'gemtranslate'),
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
				message: __('Assignment created and the translator notified.', 'gemtranslate'),
			});
		} catch (err) {
			onToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<Card title={__('New assignment', 'gemtranslate')} className="gtrans-mb-6">
			<div className="gtrans-grid gtrans-gap-3 md:gtrans-grid-cols-2">
				<Field label={__('Post type', 'gemtranslate')}>
					<Select
						value={postType}
						onChange={(e) => {
							setPostType(e.target.value);
							setPostId('');
						}}
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
				<Field label={__('Search content', 'gemtranslate')}>
					<TextInput
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={__('Filter by title…', 'gemtranslate')}
					/>
				</Field>
				<Field label={__('Content', 'gemtranslate')}>
					<Select value={postId} onChange={(e) => setPostId(e.target.value)}>
						<option value="">{__('— Pick content —', 'gemtranslate')}</option>
						{postRows.map((p) => (
							<option key={p.id} value={p.id}>
								{truncate(p.title, 70)}
							</option>
						))}
					</Select>
				</Field>
				<Field label={__('Language', 'gemtranslate')}>
					<Select value={lang} onChange={(e) => setLang(e.target.value)}>
						<option value="">{__('— Pick language —', 'gemtranslate')}</option>
						{nonDefault.map((l) => (
							<option key={l.code} value={l.code}>
								{l.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label={__('Translator', 'gemtranslate')}>
					<Select value={translatorId} onChange={(e) => setTranslatorId(e.target.value)}>
						<option value="">{__('— Pick translator —', 'gemtranslate')}</option>
						{(translators.data || []).map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label={__('Note (optional)', 'gemtranslate')}>
					<TextArea
						rows={2}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder={__('Instructions for the translator…', 'gemtranslate')}
					/>
				</Field>
			</div>
			<div className="gtrans-mt-4 gtrans-flex gtrans-justify-end">
				<Button onClick={submit} loading={create.isPending}>
					{__('Assign & notify', 'gemtranslate')}
				</Button>
			</div>
		</Card>
	);
}

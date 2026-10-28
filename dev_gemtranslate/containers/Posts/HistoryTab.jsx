import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { FormSkeleton, TableSkeleton } from '../../components/Skeleton';
import { useRevision, useRevisions, useRevertRevision } from '../../hooks/useRevisions';
import { formatErrorMessage, truncate } from '../../lib/format';

export default function HistoryTab({ postId, targetLang }) {
	const list = useRevisions(postId, targetLang);
	const [selected, setSelected] = useState(null);
	const detail = useRevision(postId, targetLang, selected);
	const revert = useRevertRevision();
	const [toast, setToast] = useState(null);

	if (list.isLoading) return <FormSkeleton />;

	if (!list.data || list.data.length === 0) {
		return (
			<Card>
				<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
					{__('No revisions yet. Each save creates a new history entry (up to 20 per translation).', 'gemtranslate')}
				</p>
			</Card>
		);
	}

	const onRevert = async () => {
		if (!selected) return;
		if (!window.confirm(__('Revert the live translation to this revision? The current version will be saved as a new revision.', 'gemtranslate'))) return;
		try {
			await revert.mutateAsync({ postId, lang: targetLang, revisionId: selected });
			setToast({ tone: 'success', message: __('Reverted.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-6">
				<Card padded={false} title={__('Revisions', 'gemtranslate')}>
					<ul className="gtrans-m-0 gtrans-flex gtrans-flex-col gtrans-p-0 gtrans-list-none">
						{list.data.map((rev) => (
							<li
								key={rev.revision_id}
								onClick={() => setSelected(rev.revision_id)}
								className={`gtrans-cursor-pointer gtrans-border-b gtrans-border-line gtrans-px-4 gtrans-py-3 gtrans-text-sm ${
									selected === rev.revision_id ? 'gtrans-bg-blue-50' : 'hover:gtrans-bg-body'
								}`}
							>
								<div className="gtrans-flex gtrans-items-center gtrans-justify-between">
									<strong className="gtrans-text-ink">#{rev.revision_id}</strong>
									<StatusPill tone={rev.status === 'publish' ? 'translated' : 'pending'}>{rev.status}</StatusPill>
								</div>
								<div className="gtrans-mt-1 gtrans-text-xs gtrans-text-muted">
									{rev.created_at}
									{rev.author?.name && (
										<>
											{' · '}{rev.author.name}
										</>
									)}
								</div>
								<div className="gtrans-mt-1 gtrans-text-xs">
									{rev.title_preview
										? truncate(rev.title_preview, 80)
										: rev.note === 'string_fields'
											? __('Strings only — field translations', 'gemtranslate')
											: __('(no title)', 'gemtranslate')}
								</div>
								<div className="gtrans-mt-1 gtrans-text-xs gtrans-text-muted">
									{sprintf(/* translators: %d: byte length. */ __('%d chars', 'gemtranslate'), rev.content_size)}
								</div>
							</li>
						))}
					</ul>
				</Card>

				<Card title={selected ? sprintf(/* translators: %d: revision id. */ __('Revision #%d', 'gemtranslate'), selected) : __('Pick a revision', 'gemtranslate')}>
					{!selected ? (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
							{__('Select a revision from the list to view its contents.', 'gemtranslate')}
						</p>
					) : detail.isLoading ? (
						<TableSkeleton />
					) : !detail.data ? (
						<p className="gtrans-text-danger">{__('Revision not available.', 'gemtranslate')}</p>
					) : (
						<div className="gtrans-flex gtrans-flex-col gtrans-gap-3 gtrans-text-sm">
							<div>
								<div className="gtrans-text-xs gtrans-text-muted gtrans-mb-1">{__('Title', 'gemtranslate')}</div>
								<div className="gtrans-rounded gtrans-bg-body gtrans-px-3 gtrans-py-2">{detail.data.title || '—'}</div>
							</div>
							<div>
								<div className="gtrans-text-xs gtrans-text-muted gtrans-mb-1">{__('Excerpt', 'gemtranslate')}</div>
								<div className="gtrans-rounded gtrans-bg-body gtrans-px-3 gtrans-py-2 gtrans-whitespace-pre-wrap">{detail.data.excerpt || '—'}</div>
							</div>
							<div>
								<div className="gtrans-text-xs gtrans-text-muted gtrans-mb-1">{__('Content', 'gemtranslate')}</div>
								<pre className="gtrans-max-h-72 gtrans-overflow-auto gtrans-rounded gtrans-bg-body gtrans-p-3 gtrans-text-xs gtrans-whitespace-pre-wrap">{detail.data.content || '—'}</pre>
							</div>
							<div className="gtrans-flex gtrans-justify-end">
								<Button onClick={onRevert} loading={revert.isPending}>
									{__('Revert to this revision', 'gemtranslate')}
								</Button>
							</div>
						</div>
					)}
				</Card>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

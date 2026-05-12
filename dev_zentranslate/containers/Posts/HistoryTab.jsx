import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
import { useRevision, useRevisions, useRevertRevision } from '../../hooks/useRevisions';
import { formatErrorMessage, truncate } from '../../lib/format';

export default function HistoryTab({ postId, targetLang }) {
	const list = useRevisions(postId, targetLang);
	const [selected, setSelected] = useState(null);
	const detail = useRevision(postId, targetLang, selected);
	const revert = useRevertRevision();
	const [toast, setToast] = useState(null);

	if (list.isLoading) return <LoadingBlock>{__('Loading history…', 'zentranslate')}</LoadingBlock>;

	if (!list.data || list.data.length === 0) {
		return (
			<Card>
				<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
					{__('No revisions yet. Each save creates a new history entry (up to 20 per translation).', 'zentranslate')}
				</p>
			</Card>
		);
	}

	const onRevert = async () => {
		if (!selected) return;
		if (!window.confirm(__('Revert the live translation to this revision? The current version will be saved as a new revision.', 'zentranslate'))) return;
		try {
			await revert.mutateAsync({ postId, lang: targetLang, revisionId: selected });
			setToast({ tone: 'success', message: __('Reverted.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<div className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-6">
				<Card padded={false} title={__('Revisions', 'zentranslate')}>
					<ul className="ztrans-m-0 ztrans-flex ztrans-flex-col ztrans-p-0 ztrans-list-none">
						{list.data.map((rev) => (
							<li
								key={rev.revision_id}
								onClick={() => setSelected(rev.revision_id)}
								className={`ztrans-cursor-pointer ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm ${
									selected === rev.revision_id ? 'ztrans-bg-blue-50' : 'hover:ztrans-bg-ztrans-bg'
								}`}
							>
								<div className="ztrans-flex ztrans-items-center ztrans-justify-between">
									<strong className="ztrans-text-gray-900">#{rev.revision_id}</strong>
									<StatusPill tone={rev.status === 'publish' ? 'translated' : 'pending'}>{rev.status}</StatusPill>
								</div>
								<div className="ztrans-mt-1 ztrans-text-xs ztrans-text-ztrans-muted">
									{rev.created_at}
									{rev.author?.name && (
										<>
											{' · '}{rev.author.name}
										</>
									)}
								</div>
								<div className="ztrans-mt-1 ztrans-text-xs">{truncate(rev.title_preview || __('(no title)', 'zentranslate'), 80)}</div>
								<div className="ztrans-mt-1 ztrans-text-xs ztrans-text-ztrans-muted">
									{sprintf(/* translators: %d: byte length. */ __('%d chars', 'zentranslate'), rev.content_size)}
								</div>
							</li>
						))}
					</ul>
				</Card>

				<Card title={selected ? sprintf(/* translators: %d: revision id. */ __('Revision #%d', 'zentranslate'), selected) : __('Pick a revision', 'zentranslate')}>
					{!selected ? (
						<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
							{__('Select a revision from the list to view its contents.', 'zentranslate')}
						</p>
					) : detail.isLoading ? (
						<LoadingBlock>{__('Loading revision…', 'zentranslate')}</LoadingBlock>
					) : !detail.data ? (
						<p className="ztrans-text-ztrans-danger">{__('Revision not available.', 'zentranslate')}</p>
					) : (
						<div className="ztrans-flex ztrans-flex-col ztrans-gap-3 ztrans-text-sm">
							<div>
								<div className="ztrans-text-xs ztrans-text-ztrans-muted ztrans-mb-1">{__('Title', 'zentranslate')}</div>
								<div className="ztrans-rounded ztrans-bg-ztrans-bg ztrans-px-3 ztrans-py-2">{detail.data.title || '—'}</div>
							</div>
							<div>
								<div className="ztrans-text-xs ztrans-text-ztrans-muted ztrans-mb-1">{__('Excerpt', 'zentranslate')}</div>
								<div className="ztrans-rounded ztrans-bg-ztrans-bg ztrans-px-3 ztrans-py-2 ztrans-whitespace-pre-wrap">{detail.data.excerpt || '—'}</div>
							</div>
							<div>
								<div className="ztrans-text-xs ztrans-text-ztrans-muted ztrans-mb-1">{__('Content', 'zentranslate')}</div>
								<pre className="ztrans-max-h-72 ztrans-overflow-auto ztrans-rounded ztrans-bg-ztrans-bg ztrans-p-3 ztrans-text-xs ztrans-whitespace-pre-wrap">{detail.data.content || '—'}</pre>
							</div>
							<div className="ztrans-flex ztrans-justify-end">
								<Button onClick={onRevert} loading={revert.isPending}>
									{__('Revert to this revision', 'zentranslate')}
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

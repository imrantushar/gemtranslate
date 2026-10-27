import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
import { Field, Select } from '../../components/Input';
import { useJobs, useJobCounts, useRetryJob, useDeleteJob } from '../../hooks/useJobs';
import { formatErrorMessage } from '../../lib/format';

const TONE = {
	pending: 'pending',
	running: 'pending',
	success: 'translated',
	failed: 'draft',
};

export default function JobsPage() {
	const [status, setStatus] = useState('');
	const jobs = useJobs({ status, page: 1, per_page: 100 });
	const counts = useJobCounts();
	const retry = useRetryJob();
	const remove = useDeleteJob();
	const [toast, setToast] = useState(null);

	const onRetry = async (id) => {
		try {
			await retry.mutateAsync(id);
			setToast({ tone: 'success', message: __('Re-queued.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onDelete = async (id) => {
		if (!window.confirm(__('Remove this job from the list?', 'gemtranslate'))) return;
		try {
			await remove.mutateAsync(id);
			setToast({ tone: 'success', message: __('Job removed.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Translation jobs', 'gemtranslate')}
				description={__('Monitor async AI translation jobs. Pending and running jobs poll for updates.', 'gemtranslate')}
			/>

			<div className="gtrans-mb-6 gtrans-grid gtrans-gap-4 gtrans-grid-cols-2 md:gtrans-grid-cols-4">
				<Card padded title={__('Pending', 'gemtranslate')}>
					<div className="gtrans-text-2xl gtrans-font-semibold">{counts.data?.pending ?? 0}</div>
				</Card>
				<Card padded title={__('Running', 'gemtranslate')}>
					<div className="gtrans-text-2xl gtrans-font-semibold">{counts.data?.running ?? 0}</div>
				</Card>
				<Card padded title={__('Success', 'gemtranslate')}>
					<div className="gtrans-text-2xl gtrans-font-semibold">{counts.data?.success ?? 0}</div>
				</Card>
				<Card padded title={__('Failed', 'gemtranslate')}>
					<div className="gtrans-text-2xl gtrans-font-semibold">{counts.data?.failed ?? 0}</div>
				</Card>
			</div>

			<Card padded={false}>
				<div className="gtrans-flex gtrans-flex-wrap gtrans-items-end gtrans-gap-3 gtrans-border-b gtrans-border-gtrans-border gtrans-px-4 gtrans-py-3">
					<div className="gtrans-min-w-[160px]">
						<Field label={__('Status', 'gemtranslate')}>
							<Select value={status} onChange={(e) => setStatus(e.target.value)}>
								<option value="">{__('All', 'gemtranslate')}</option>
								<option value="pending">{__('Pending', 'gemtranslate')}</option>
								<option value="running">{__('Running', 'gemtranslate')}</option>
								<option value="success">{__('Success', 'gemtranslate')}</option>
								<option value="failed">{__('Failed', 'gemtranslate')}</option>
							</Select>
						</Field>
					</div>
				</div>
				{jobs.isLoading ? (
					<LoadingBlock>{__('Loading jobs…', 'gemtranslate')}</LoadingBlock>
				) : (jobs.data?.rows || []).length === 0 ? (
					<p className="gtrans-px-5 gtrans-py-8 gtrans-text-center gtrans-text-sm gtrans-text-gtrans-muted">
						{__('No jobs in this view.', 'gemtranslate')}
					</p>
				) : (
					<table className="gtrans-w-full gtrans-text-sm">
						<thead className="gtrans-bg-gtrans-bg gtrans-text-left gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
							<tr>
								<th className="gtrans-px-4 gtrans-py-3">#</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Type', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Status', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Payload', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Attempts', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Updated', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(jobs.data?.rows || []).map((j) => (
								<tr key={j.job_id} className="gtrans-border-t gtrans-border-gtrans-border gtrans-align-top">
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-gtrans-muted">{j.job_id}</td>
									<td className="gtrans-px-4 gtrans-py-3">{j.type}</td>
									<td className="gtrans-px-4 gtrans-py-3"><StatusPill tone={TONE[j.status] || 'none'}>{j.status}</StatusPill></td>
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-xs gtrans-text-gtrans-muted">
										{j.payload?.kind === 'post_translate'
											? sprintf(
												/* translators: 1: post ID, 2: target language. */
												__('post #%1$d → %2$s', 'gemtranslate'),
												j.payload.post_id,
												j.payload.target_lang
											)
											: <code>{JSON.stringify(j.payload)}</code>
										}
										{j.error && (
											<div className="gtrans-mt-1 gtrans-text-gtrans-danger">{j.error}</div>
										)}
									</td>
									<td className="gtrans-px-4 gtrans-py-3">{j.attempts}</td>
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-xs gtrans-text-gtrans-muted">{j.updated_at}</td>
									<td className="gtrans-px-4 gtrans-py-3 gtrans-text-right">
										<div className="gtrans-flex gtrans-justify-end gtrans-gap-1">
											{(j.status === 'failed' || j.status === 'pending') && (
												<Button size="sm" variant="ghost" onClick={() => onRetry(j.job_id)}>
													{__('Retry', 'gemtranslate')}
												</Button>
											)}
											<Button size="sm" variant="ghost" onClick={() => onDelete(j.job_id)}>
												{__('Delete', 'gemtranslate')}
											</Button>
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

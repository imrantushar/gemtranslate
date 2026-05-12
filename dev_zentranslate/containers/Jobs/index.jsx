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
			setToast({ tone: 'success', message: __('Re-queued.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onDelete = async (id) => {
		if (!window.confirm(__('Remove this job from the list?', 'zentranslate'))) return;
		try {
			await remove.mutateAsync(id);
			setToast({ tone: 'success', message: __('Job removed.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Translation jobs', 'zentranslate')}
				description={__('Monitor async AI translation jobs. Pending and running jobs poll for updates.', 'zentranslate')}
			/>

			<div className="ztrans-mb-6 ztrans-grid ztrans-gap-4 ztrans-grid-cols-2 md:ztrans-grid-cols-4">
				<Card padded title={__('Pending', 'zentranslate')}>
					<div className="ztrans-text-2xl ztrans-font-semibold">{counts.data?.pending ?? 0}</div>
				</Card>
				<Card padded title={__('Running', 'zentranslate')}>
					<div className="ztrans-text-2xl ztrans-font-semibold">{counts.data?.running ?? 0}</div>
				</Card>
				<Card padded title={__('Success', 'zentranslate')}>
					<div className="ztrans-text-2xl ztrans-font-semibold">{counts.data?.success ?? 0}</div>
				</Card>
				<Card padded title={__('Failed', 'zentranslate')}>
					<div className="ztrans-text-2xl ztrans-font-semibold">{counts.data?.failed ?? 0}</div>
				</Card>
			</div>

			<Card padded={false}>
				<div className="ztrans-flex ztrans-flex-wrap ztrans-items-end ztrans-gap-3 ztrans-border-b ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3">
					<div className="ztrans-min-w-[160px]">
						<Field label={__('Status', 'zentranslate')}>
							<Select value={status} onChange={(e) => setStatus(e.target.value)}>
								<option value="">{__('All', 'zentranslate')}</option>
								<option value="pending">{__('Pending', 'zentranslate')}</option>
								<option value="running">{__('Running', 'zentranslate')}</option>
								<option value="success">{__('Success', 'zentranslate')}</option>
								<option value="failed">{__('Failed', 'zentranslate')}</option>
							</Select>
						</Field>
					</div>
				</div>
				{jobs.isLoading ? (
					<LoadingBlock>{__('Loading jobs…', 'zentranslate')}</LoadingBlock>
				) : (jobs.data?.rows || []).length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No jobs in this view.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">#</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Type', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Status', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Payload', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Attempts', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Updated', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{(jobs.data?.rows || []).map((j) => (
								<tr key={j.job_id} className="ztrans-border-t ztrans-border-ztrans-border ztrans-align-top">
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-ztrans-muted">{j.job_id}</td>
									<td className="ztrans-px-4 ztrans-py-3">{j.type}</td>
									<td className="ztrans-px-4 ztrans-py-3"><StatusPill tone={TONE[j.status] || 'none'}>{j.status}</StatusPill></td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-xs ztrans-text-ztrans-muted">
										{j.payload?.kind === 'post_translate'
											? sprintf(
												/* translators: 1: post ID, 2: target language. */
												__('post #%1$d → %2$s', 'zentranslate'),
												j.payload.post_id,
												j.payload.target_lang
											)
											: <code>{JSON.stringify(j.payload)}</code>
										}
										{j.error && (
											<div className="ztrans-mt-1 ztrans-text-ztrans-danger">{j.error}</div>
										)}
									</td>
									<td className="ztrans-px-4 ztrans-py-3">{j.attempts}</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-xs ztrans-text-ztrans-muted">{j.updated_at}</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
										<div className="ztrans-flex ztrans-justify-end ztrans-gap-1">
											{(j.status === 'failed' || j.status === 'pending') && (
												<Button size="sm" variant="ghost" onClick={() => onRetry(j.job_id)}>
													{__('Retry', 'zentranslate')}
												</Button>
											)}
											<Button size="sm" variant="ghost" onClick={() => onDelete(j.job_id)}>
												{__('Delete', 'zentranslate')}
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

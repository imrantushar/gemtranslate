import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { Table } from '../../components/ui/Table';
import Button from '../../components/Button';
import StatusTabs from '../../components/StatusTabs';

import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { TableSkeleton } from '../../components/Skeleton';
import { Field } from '../../components/Input';
import { Select } from '../../components/ui/Select';
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

			<Card table>
				<Table.Toolbar variant="tabs">
					<StatusTabs
						value={status}
						onChange={setStatus}
						tabs={[
							{ value: '', label: __('All', 'gemtranslate') },
							{ value: 'pending', label: __('Pending', 'gemtranslate'), count: counts.data?.pending ?? 0 },
							{ value: 'running', label: __('Running', 'gemtranslate'), count: counts.data?.running ?? 0 },
							{ value: 'success', label: __('Success', 'gemtranslate'), count: counts.data?.success ?? 0 },
							{ value: 'failed', label: __('Failed', 'gemtranslate'), count: counts.data?.failed ?? 0 },
						]}
					/>
				</Table.Toolbar>
				{jobs.isLoading ? (
					<TableSkeleton />
				) : (jobs.data?.rows || []).length === 0 ? (
					<Table.Empty>
						{__('No jobs in this view.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeader>#</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Type', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Status', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Payload', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Attempts', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader>{__('Updated', 'gemtranslate')}</Table.ColumnHeader>
								<Table.ColumnHeader />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{(jobs.data?.rows || []).map((j) => (
								<Table.Row key={j.job_id} className="gtrans-align-top">
									<Table.Cell className="gtrans-text-muted">{j.job_id}</Table.Cell>
									<Table.Cell>{j.type}</Table.Cell>
									<Table.Cell><StatusPill tone={TONE[j.status] || 'none'}>{j.status}</StatusPill></Table.Cell>
									<Table.Cell className="gtrans-text-xs gtrans-text-muted">
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
											<div className="gtrans-mt-1 gtrans-text-danger">{j.error}</div>
										)}
									</Table.Cell>
									<Table.Cell>{j.attempts}</Table.Cell>
									<Table.Cell className="gtrans-text-xs gtrans-text-muted">{j.updated_at}</Table.Cell>
									<Table.Cell className="gtrans-text-right">
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
import { useReviewQueue, useApproveTranslation, useRejectTranslation } from '../../hooks/useReview';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage, truncate } from '../../lib/format';

export default function ReviewPage() {
	const [page, setPage] = useState(1);
	const queue = useReviewQueue(page, 20);
	const languages = useLanguages();
	const approve = useApproveTranslation();
	const reject = useRejectTranslation();
	const [toast, setToast] = useState(null);
	const [busyKey, setBusyKey] = useState(null);

	const langName = (code) =>
		(languages.data || []).find((l) => l.code === code)?.name || code.toUpperCase();

	const rowKey = (r) => `${r.post_id}:${r.language_code}:${r.country_code}`;

	const doApprove = async (r) => {
		setBusyKey(rowKey(r));
		try {
			await approve.mutateAsync({
				postId: r.post_id,
				lang: r.language_code,
				country: r.country_code,
			});
			setToast({
				tone: 'success',
				message: __('Translation approved and published.', 'gemtranslate'),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setBusyKey(null);
		}
	};

	const doReject = async (r) => {
		// eslint-disable-next-line no-alert
		if (
			!window.confirm(
				__(
					'Discard this translation? The source will be shown until it is translated again.',
					'gemtranslate'
				)
			)
		) {
			return;
		}
		setBusyKey(rowKey(r));
		try {
			await reject.mutateAsync({
				postId: r.post_id,
				lang: r.language_code,
				country: r.country_code,
			});
			setToast({
				tone: 'success',
				message: __('Translation discarded.', 'gemtranslate'),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setBusyKey(null);
		}
	};

	const rows = queue.data?.rows || [];
	const meta = queue.data?.meta;

	return (
		<>
			<PageHeader
				title={__('Review queue', 'gemtranslate')}
				description={__(
					'Automatic translations waiting for your approval before they go live. Approve to publish, edit to refine, or discard.',
					'gemtranslate'
				)}
			/>

			<Card padded={false}>
				{queue.isLoading ? (
					<LoadingBlock>{__('Loading review queue…', 'gemtranslate')}</LoadingBlock>
				) : rows.length === 0 ? (
					<p className="gtrans-px-5 gtrans-py-10 gtrans-text-center gtrans-text-sm gtrans-text-gtrans-muted">
						{__(
							'Nothing waiting for review. New automatic translations will appear here when "Hold for review" is on.',
							'gemtranslate'
						)}
					</p>
				) : (
					<table className="gtrans-w-full gtrans-text-sm">
						<thead className="gtrans-bg-gtrans-bg gtrans-text-left gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
							<tr>
								<th className="gtrans-px-4 gtrans-py-3">{__('Content', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Language', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3">{__('Preview', 'gemtranslate')}</th>
								<th className="gtrans-px-4 gtrans-py-3 gtrans-text-right">
									{__('Actions', 'gemtranslate')}
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => {
								const busy = busyKey === rowKey(r);
								return (
									<tr
										key={rowKey(r)}
										className="gtrans-border-t gtrans-border-gtrans-border gtrans-align-top"
									>
										<td className="gtrans-px-4 gtrans-py-3 gtrans-max-w-[280px]">
											<div className="gtrans-font-medium gtrans-text-gray-900">
												{truncate(r.source_title || `#${r.post_id}`, 60)}
											</div>
											<div className="gtrans-text-xs gtrans-text-gtrans-muted">{r.post_type}</div>
										</td>
										<td className="gtrans-px-4 gtrans-py-3">
											<StatusPill tone="pending">
												{langName(r.language_code)}
												{r.country_code ? ` · ${r.country_code}` : ''}
											</StatusPill>
										</td>
										<td className="gtrans-px-4 gtrans-py-3 gtrans-max-w-[360px] gtrans-text-gray-700">
											{r.snippet || <span className="gtrans-text-gtrans-muted">—</span>}
										</td>
										<td className="gtrans-px-4 gtrans-py-3">
											<div className="gtrans-flex gtrans-items-center gtrans-justify-end gtrans-gap-2">
												<Link
													to={`/posts/${r.post_id}`}
													className="gtrans-rounded-md gtrans-border gtrans-border-gtrans-border gtrans-bg-white gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-text-gray-700 gtrans-no-underline hover:gtrans-bg-gray-50"
												>
													{__('Edit', 'gemtranslate')}
												</Link>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => doReject(r)}
													disabled={busy}
												>
													{__('Discard', 'gemtranslate')}
												</Button>
												<Button size="sm" onClick={() => doApprove(r)} loading={busy}>
													{__('Approve', 'gemtranslate')}
												</Button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}

				{meta?.total_pages > 1 && (
					<div className="gtrans-flex gtrans-justify-between gtrans-border-t gtrans-border-gtrans-border gtrans-px-4 gtrans-py-3 gtrans-text-sm">
						<span className="gtrans-text-gtrans-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages. */
								__('Page %1$d of %2$d', 'gemtranslate'),
								page,
								meta.total_pages
							)}
						</span>
						<div className="gtrans-flex gtrans-gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								{__('Previous', 'gemtranslate')}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={page >= meta.total_pages}
								onClick={() => setPage((p) => p + 1)}
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

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
					<p className="ztrans-px-5 ztrans-py-10 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__(
							'Nothing waiting for review. New automatic translations will appear here when "Hold for review" is on.',
							'gemtranslate'
						)}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Content', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Language', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('Preview', 'gemtranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
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
										className="ztrans-border-t ztrans-border-ztrans-border ztrans-align-top"
									>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-max-w-[280px]">
											<div className="ztrans-font-medium ztrans-text-gray-900">
												{truncate(r.source_title || `#${r.post_id}`, 60)}
											</div>
											<div className="ztrans-text-xs ztrans-text-ztrans-muted">{r.post_type}</div>
										</td>
										<td className="ztrans-px-4 ztrans-py-3">
											<StatusPill tone="pending">
												{langName(r.language_code)}
												{r.country_code ? ` · ${r.country_code}` : ''}
											</StatusPill>
										</td>
										<td className="ztrans-px-4 ztrans-py-3 ztrans-max-w-[360px] ztrans-text-gray-700">
											{r.snippet || <span className="ztrans-text-ztrans-muted">—</span>}
										</td>
										<td className="ztrans-px-4 ztrans-py-3">
											<div className="ztrans-flex ztrans-items-center ztrans-justify-end ztrans-gap-2">
												<Link
													to={`/posts/${r.post_id}`}
													className="ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-px-3 ztrans-py-1.5 ztrans-text-xs ztrans-text-gray-700 ztrans-no-underline hover:ztrans-bg-gray-50"
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
					<div className="ztrans-flex ztrans-justify-between ztrans-border-t ztrans-border-ztrans-border ztrans-px-4 ztrans-py-3 ztrans-text-sm">
						<span className="ztrans-text-ztrans-muted">
							{sprintf(
								/* translators: 1: current page, 2: total pages. */
								__('Page %1$d of %2$d', 'gemtranslate'),
								page,
								meta.total_pages
							)}
						</span>
						<div className="ztrans-flex ztrans-gap-2">
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

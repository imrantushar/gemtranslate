import React from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { Select } from './ui/Select';
import { cx } from './ui/cx';

const PER_PAGE_OPTIONS = [10, 15, 20, 25, 30, 50];

// 1 2 3 … 10 | 1 … 8 9 10 | 1 … 4 5 6 … 10 (same windowing as GemCRM).
function pageWindow(page, totalPages) {
	if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
	if (page <= 3) return [1, 2, 3, '…', totalPages];
	if (page >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages];
	return [1, '…', page - 1, page, page + 1, '…', totalPages];
}

const Chevron = ({ dir }) => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
	</svg>
);

const navBtn =
	'gtrans-bare gtrans-flex gtrans-h-[30px] gtrans-w-[30px] gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-border-0 gtrans-bg-body gtrans-p-0 gtrans-text-muted hover:gtrans-bg-primary hover:gtrans-text-white';

/**
 * Table footer: "Showing result X out of Y", rows-per-page select and numbered
 * pages with prev/next. Mirrors GemCRM's ListTable footer.
 *
 * `shown` is the number of rows on the current page; omit `onPerPage` to hide
 * the rows-per-page select (e.g. when the page size is fixed).
 */
export default function Pagination({ total = 0, shown = 0, page = 1, perPage = 10, onPage, onPerPage, className = '' }) {
	if (total <= 0) return null;

	const totalPages = Math.max(1, Math.ceil(total / perPage));
	const options = PER_PAGE_OPTIONS.includes(perPage) ? PER_PAGE_OPTIONS : [...PER_PAGE_OPTIONS, perPage].sort((a, b) => a - b);

	return (
		<div className={cx('gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-4 gtrans-border-0 gtrans-border-t gtrans-border-solid gtrans-border-line gtrans-px-1 gtrans-pt-4 gtrans-mt-3 gtrans-text-sm gtrans-text-ink', className)}>
			<span>
				{sprintf(
					/* translators: 1: rows on this page, 2: total rows. */
					__('Showing result %1$d out of %2$d', 'gemtranslate'),
					shown,
					total
				)}
			</span>

			{(total > Math.min(...options) || totalPages > 1) && (
				<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-6">
					{onPerPage && (
						<div className="gtrans-flex gtrans-items-center gtrans-gap-3">
							<span className="gtrans-text-muted">{__('Rows per page', 'gemtranslate')}</span>
							<Select
								className="gtrans-w-[110px]"
								value={perPage}
								isSearchable={false}
								menuPlacement="top"
								onChange={(e) => onPerPage(Number(e.target.value))}
							>
								{options.map((n) => (
									<option key={n} value={n}>{n}</option>
								))}
							</Select>
						</div>
					)}

					{totalPages > 1 && (
						<div className="gtrans-flex gtrans-items-center gtrans-gap-2">
							{page > 1 && (
								<button type="button" className={navBtn} aria-label={__('Previous page', 'gemtranslate')} onClick={() => onPage(page - 1)}>
									<Chevron dir="left" />
								</button>
							)}
							<ul className="gtrans-m-0 gtrans-flex gtrans-list-none gtrans-items-center gtrans-gap-2.5 gtrans-p-1">
								{pageWindow(page, totalPages).map((p, i) =>
									p === '…' ? (
										<li key={`dots-${i}`} className="gtrans-m-0 gtrans-px-3 gtrans-text-muted gtrans-pointer-events-none">…</li>
									) : (
										<li key={p} className="gtrans-m-0">
											<button
												type="button"
												aria-current={p === page ? 'page' : undefined}
												onClick={() => p !== page && onPage(p)}
												className={cx(
													'gtrans-bare gtrans-h-[30px] gtrans-min-w-[34px] gtrans-rounded gtrans-border gtrans-border-solid gtrans-px-2 gtrans-text-sm gtrans-font-medium',
													p === page
														? 'gtrans-cursor-default gtrans-border-primary gtrans-bg-primary gtrans-text-white'
														: 'gtrans-cursor-pointer gtrans-border-line gtrans-bg-surface gtrans-text-ink hover:gtrans-bg-body'
												)}
											>
												{p}
											</button>
										</li>
									)
								)}
							</ul>
							{page < totalPages && (
								<button type="button" className={navBtn} aria-label={__('Next page', 'gemtranslate')} onClick={() => onPage(page + 1)}>
									<Chevron dir="right" />
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

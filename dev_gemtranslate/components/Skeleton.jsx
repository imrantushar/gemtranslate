import clsx from 'clsx';

/** Single pulsing placeholder bar. */
export function Skeleton({ className }) {
	return <div aria-hidden="true" className={clsx('gtrans-animate-pulse gtrans-rounded gtrans-bg-line gtrans-h-4', className)} />;
}

// Varied widths so rows don't look like a barcode.
const WIDTHS = ['gtrans-w-3/4', 'gtrans-w-1/2', 'gtrans-w-2/3', 'gtrans-w-1/3', 'gtrans-w-5/6'];

/** List-table placeholder: header band + rows (GemCRM's TableSkeleton). */
export function TableSkeleton({ rows = 5, columns = 4 }) {
	return (
		<div role="status" aria-busy="true" aria-live="polite">
			<div className="gtrans-flex gtrans-gap-4 gtrans-rounded gtrans-bg-body gtrans-px-3 gtrans-py-4">
				{Array.from({ length: columns }).map((_, c) => (
					<Skeleton key={c} className="gtrans-h-3.5 gtrans-flex-1" />
				))}
			</div>
			{Array.from({ length: rows }).map((_, r) => (
				<div key={r} className="gtrans-flex gtrans-items-center gtrans-gap-4 gtrans-border-b gtrans-border-line gtrans-px-3 gtrans-py-4">
					{Array.from({ length: columns }).map((_, c) => (
						<div key={c} className="gtrans-flex-1">
							<Skeleton className={WIDTHS[(r + c) % WIDTHS.length]} />
						</div>
					))}
				</div>
			))}
		</div>
	);
}

/** Form / panel placeholder: label + field pairs. */
export function FormSkeleton({ fields = 4 }) {
	return (
		<div role="status" aria-busy="true" aria-live="polite" className="gtrans-flex gtrans-flex-col gtrans-gap-5">
			{Array.from({ length: fields }).map((_, i) => (
				<div key={i} className="gtrans-flex gtrans-flex-col gtrans-gap-2">
					<Skeleton className="gtrans-h-3 gtrans-w-24" />
					<Skeleton className="gtrans-h-10 gtrans-w-full" />
				</div>
			))}
		</div>
	);
}

/** Whole-page placeholder: heading + description, optional stat cards, then a table card. */
export function PageSkeleton({ stats = 0, rows = 5, columns = 4 }) {
	return (
		<div role="status" aria-busy="true" aria-live="polite">
			<div className="gtrans-mb-6 gtrans-flex gtrans-flex-col gtrans-gap-2">
				<Skeleton className="gtrans-h-6 gtrans-w-48" />
				<Skeleton className="gtrans-h-3.5 gtrans-w-80 gtrans-max-w-full" />
			</div>
			{stats > 0 && (
				<div className="gtrans-mb-4 gtrans-grid gtrans-grid-cols-2 gtrans-gap-4 md:gtrans-grid-cols-4">
					{Array.from({ length: stats }).map((_, i) => (
						<div key={i} className="gtrans-flex gtrans-flex-col gtrans-gap-3 gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-5">
							<Skeleton className="gtrans-h-3.5 gtrans-w-1/2" />
							<Skeleton className="gtrans-h-8 gtrans-w-1/3" />
							<Skeleton className="gtrans-h-3 gtrans-w-2/3" />
						</div>
					))}
				</div>
			)}
			<div className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-6">
				<TableSkeleton rows={rows} columns={columns} />
			</div>
		</div>
	);
}

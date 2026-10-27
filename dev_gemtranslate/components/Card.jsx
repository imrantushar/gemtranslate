import clsx from 'clsx';

export default function Card({ title, action, children, className, padded = true, table = false }) {
	return (
		<section className={clsx('gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-shadow-gtrans', className)}>
			{(title || action) && (
				<header className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-border-b gtrans-border-divider gtrans-px-5 gtrans-py-3">
					{title && <h2 className="gtrans-section-title">{title}</h2>}
					{action}
				</header>
			)}
			<div className={clsx(padded && 'gtrans-p-5', table && 'gtrans-p-6')}>{children}</div>
		</section>
	);
}

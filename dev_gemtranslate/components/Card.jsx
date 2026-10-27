import clsx from 'clsx';

export default function Card({ title, action, children, className, padded = true }) {
	return (
		<section className={clsx('gtrans-rounded-lg gtrans-bg-white gtrans-shadow-card', className)}>
			{(title || action) && (
				<header className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-border-b gtrans-border-gtrans-border gtrans-px-5 gtrans-py-3">
					{title && <h2 className="gtrans-m-0 gtrans-text-sm gtrans-font-semibold gtrans-text-gray-800">{title}</h2>}
					{action}
				</header>
			)}
			<div className={clsx(padded && 'gtrans-p-5')}>{children}</div>
		</section>
	);
}

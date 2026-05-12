import clsx from 'clsx';

export default function Card({ title, action, children, className, padded = true }) {
	return (
		<section className={clsx('ztrans-rounded-lg ztrans-bg-white ztrans-shadow-card', className)}>
			{(title || action) && (
				<header className="ztrans-flex ztrans-items-center ztrans-justify-between ztrans-border-b ztrans-border-ztrans-border ztrans-px-5 ztrans-py-3">
					{title && <h2 className="ztrans-m-0 ztrans-text-sm ztrans-font-semibold ztrans-text-gray-800">{title}</h2>}
					{action}
				</header>
			)}
			<div className={clsx(padded && 'ztrans-p-5')}>{children}</div>
		</section>
	);
}

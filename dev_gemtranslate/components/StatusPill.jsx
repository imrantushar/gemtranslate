import clsx from 'clsx';

const TONE = {
	none: 'gtrans-bg-gray-100 gtrans-text-gray-600',
	draft: 'gtrans-bg-amber-100 gtrans-text-amber-700',
	publish: 'gtrans-bg-green-100 gtrans-text-green-700',
	translated: 'gtrans-bg-green-100 gtrans-text-green-700',
	pending: 'gtrans-bg-blue-100 gtrans-text-blue-700',
};

export default function StatusPill({ tone = 'none', children }) {
	return (
		<span className={clsx('gtrans-inline-flex gtrans-items-center gtrans-rounded-full gtrans-px-2 gtrans-py-0.5 gtrans-text-xs gtrans-font-medium', TONE[tone] || TONE.none)}>
			{children}
		</span>
	);
}

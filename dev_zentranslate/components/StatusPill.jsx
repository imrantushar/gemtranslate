import clsx from 'clsx';

const TONE = {
	none: 'ztrans-bg-gray-100 ztrans-text-gray-600',
	draft: 'ztrans-bg-amber-100 ztrans-text-amber-700',
	publish: 'ztrans-bg-green-100 ztrans-text-green-700',
	translated: 'ztrans-bg-green-100 ztrans-text-green-700',
	pending: 'ztrans-bg-blue-100 ztrans-text-blue-700',
};

export default function StatusPill({ tone = 'none', children }) {
	return (
		<span className={clsx('ztrans-inline-flex ztrans-items-center ztrans-rounded-full ztrans-px-2 ztrans-py-0.5 ztrans-text-xs ztrans-font-medium', TONE[tone] || TONE.none)}>
			{children}
		</span>
	);
}

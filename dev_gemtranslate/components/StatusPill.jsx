import clsx from 'clsx';

const TONE = {
	none: 'gtrans-bg-body gtrans-text-muted',
	draft: 'gtrans-bg-warning-light gtrans-text-warning',
	publish: 'gtrans-bg-success-light gtrans-text-success',
	translated: 'gtrans-bg-success-light gtrans-text-success',
	pending: 'gtrans-bg-primary-light gtrans-text-primary',
};

export default function StatusPill({ tone = 'none', children }) {
	return (
		<span className={clsx('gtrans-inline-flex gtrans-items-center gtrans-rounded-full gtrans-px-2 gtrans-py-0.5 gtrans-text-xs gtrans-font-medium', TONE[tone] || TONE.none)}>
			{children}
		</span>
	);
}

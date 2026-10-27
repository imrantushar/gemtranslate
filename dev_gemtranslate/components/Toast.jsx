import { useEffect, useState } from 'react';
import clsx from 'clsx';

const TONE = {
	success: 'ztrans-bg-green-50 ztrans-text-green-800 ztrans-border-green-200',
	error: 'ztrans-bg-red-50 ztrans-text-red-800 ztrans-border-red-200',
	info: 'ztrans-bg-blue-50 ztrans-text-blue-800 ztrans-border-blue-200',
};

export default function Toast({ message, tone = 'info', onClear, duration = 4000 }) {
	const [visible, setVisible] = useState(Boolean(message));

	useEffect(() => {
		if (!message) return undefined;
		setVisible(true);
		const t = setTimeout(() => {
			setVisible(false);
			onClear && onClear();
		}, duration);
		return () => clearTimeout(t);
	}, [message, duration, onClear]);

	if (!visible || !message) return null;

	return (
		<div className={clsx('ztrans-pointer-events-none ztrans-fixed ztrans-bottom-6 ztrans-right-6 ztrans-z-50 ztrans-flex ztrans-flex-col ztrans-gap-2')}>
			<div className={clsx('ztrans-pointer-events-auto ztrans-flex ztrans-items-center ztrans-rounded-md ztrans-border ztrans-px-3 ztrans-py-2 ztrans-text-sm ztrans-shadow-card', TONE[tone] || TONE.info)}>
				{message}
			</div>
		</div>
	);
}

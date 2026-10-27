import { useEffect, useState } from 'react';
import clsx from 'clsx';

const TONE = {
	success: 'gtrans-bg-green-50 gtrans-text-green-800 gtrans-border-green-200',
	error: 'gtrans-bg-red-50 gtrans-text-red-800 gtrans-border-red-200',
	info: 'gtrans-bg-blue-50 gtrans-text-blue-800 gtrans-border-blue-200',
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
		<div className={clsx('gtrans-pointer-events-none gtrans-fixed gtrans-bottom-6 gtrans-right-6 gtrans-z-50 gtrans-flex gtrans-flex-col gtrans-gap-2')}>
			<div className={clsx('gtrans-pointer-events-auto gtrans-flex gtrans-items-center gtrans-rounded-md gtrans-border gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-shadow-card', TONE[tone] || TONE.info)}>
				{message}
			</div>
		</div>
	);
}

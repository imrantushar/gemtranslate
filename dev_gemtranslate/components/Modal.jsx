import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

export default function Modal({ open, title, onClose, children, footer, size = 'md' }) {
	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			if (e.key === 'Escape') onClose && onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;

	const widthCls = size === 'lg' ? 'gtrans-max-w-3xl' : size === 'sm' ? 'gtrans-max-w-md' : 'gtrans-max-w-xl';

	return (
		<div className="gtrans-fixed gtrans-inset-0 gtrans-z-40 gtrans-flex gtrans-items-center gtrans-justify-center gtrans-bg-black/40 gtrans-p-4">
			<div className={clsx('gtrans-w-full gtrans-rounded-lg gtrans-bg-white gtrans-shadow-card', widthCls)}>
				{title && (
					<header className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-border-b gtrans-border-gtrans-border gtrans-px-5 gtrans-py-3">
						<h3 className="gtrans-m-0 gtrans-text-sm gtrans-font-semibold gtrans-text-gray-800">{title}</h3>
						<button
							type="button"
							onClick={onClose}
							className="gtrans-bare gtrans-rounded gtrans-p-1 gtrans-text-gray-500 hover:gtrans-bg-gray-100"
							aria-label={__('Close', 'gemtranslate')}
						>
							✕
						</button>
					</header>
				)}
				<div className="gtrans-p-5">{children}</div>
				{footer && <footer className="gtrans-flex gtrans-justify-end gtrans-gap-2 gtrans-border-t gtrans-border-gtrans-border gtrans-px-5 gtrans-py-3">{footer}</footer>}
			</div>
		</div>
	);
}

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

	const widthCls = size === 'lg' ? 'ztrans-max-w-3xl' : size === 'sm' ? 'ztrans-max-w-md' : 'ztrans-max-w-xl';

	return (
		<div className="ztrans-fixed ztrans-inset-0 ztrans-z-40 ztrans-flex ztrans-items-center ztrans-justify-center ztrans-bg-black/40 ztrans-p-4">
			<div className={clsx('ztrans-w-full ztrans-rounded-lg ztrans-bg-white ztrans-shadow-card', widthCls)}>
				{title && (
					<header className="ztrans-flex ztrans-items-center ztrans-justify-between ztrans-border-b ztrans-border-ztrans-border ztrans-px-5 ztrans-py-3">
						<h3 className="ztrans-m-0 ztrans-text-sm ztrans-font-semibold ztrans-text-gray-800">{title}</h3>
						<button
							type="button"
							onClick={onClose}
							className="ztrans-bare ztrans-rounded ztrans-p-1 ztrans-text-gray-500 hover:ztrans-bg-gray-100"
							aria-label={__('Close', 'gemtranslate')}
						>
							✕
						</button>
					</header>
				)}
				<div className="ztrans-p-5">{children}</div>
				{footer && <footer className="ztrans-flex ztrans-justify-end ztrans-gap-2 ztrans-border-t ztrans-border-ztrans-border ztrans-px-5 ztrans-py-3">{footer}</footer>}
			</div>
		</div>
	);
}

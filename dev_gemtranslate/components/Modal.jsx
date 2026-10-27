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
			<div className={clsx('gtrans-w-full gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-shadow-xl', widthCls)}>
				{title && (
					<header className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-border-b gtrans-border-divider gtrans-px-5 gtrans-py-3">
						<h3 className="gtrans-section-title">{title}</h3>
						<button
							type="button"
							onClick={onClose}
							className="gtrans-bare gtrans-inline-flex gtrans-h-7 gtrans-w-7 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-border gtrans-border-line gtrans-text-muted hover:gtrans-bg-body hover:gtrans-text-ink"
							aria-label={__('Close', 'gemtranslate')}
						>
							✕
						</button>
					</header>
				)}
				<div className="gtrans-p-5">{children}</div>
				{footer && <footer className="gtrans-flex gtrans-justify-end gtrans-gap-2 gtrans-border-t gtrans-border-divider gtrans-px-5 gtrans-py-3">{footer}</footer>}
			</div>
		</div>
	);
}

import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

/**
 * Modal — mirrors GemCRM's ReactModal: dimmed overlay (above the wp-admin
 * menu/bar), 6px-radius panel, header with a bottom rule and a round close
 * button, scrolling 24px content area and a footer separated by a top rule.
 * Sizes follow GemCRM's small / medium / large widths.
 */
const WIDTH = {
	sm: 'gtrans-w-[min(480px,calc(100vw-32px))]',
	md: 'gtrans-w-[min(600px,calc(100vw-32px))]',
	lg: 'gtrans-w-[min(1020px,calc(100vw-32px))]',
};

export default function Modal({ open, title, subtitle, onClose, children, footer, size = 'md' }) {
	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			if (e.key === 'Escape') onClose && onClose();
		};
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="gtrans-fixed gtrans-inset-0 gtrans-flex gtrans-justify-center gtrans-overflow-y-auto gtrans-p-4"
			style={{ zIndex: 100000, background: 'rgba(35, 40, 45, 0.62)' }}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={typeof title === 'string' ? title : undefined}
				className={clsx(
					'gtrans-relative gtrans-mb-4 gtrans-mt-[50px] gtrans-flex gtrans-h-fit gtrans-max-h-[calc(100vh-90px)] gtrans-flex-col gtrans-rounded-md gtrans-bg-surface',
					WIDTH[size] || WIDTH.md
				)}
				style={{ boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)' }}
			>
				{title && (
					<header className="gtrans-mx-6 gtrans-flex gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-border-b gtrans-border-line gtrans-py-5">
						<div className="gtrans-min-w-0">
							<h3 className="gtrans-m-0 gtrans-text-lg gtrans-font-medium gtrans-text-ink">{title}</h3>
							{subtitle && <p className="gtrans-m-0 gtrans-mt-1 gtrans-text-xs gtrans-text-muted">{subtitle}</p>}
						</div>
						<button
							type="button"
							onClick={onClose}
							aria-label={__('Close', 'gemtranslate')}
							className="gtrans-bare gtrans-flex gtrans-h-7 gtrans-w-7 gtrans-flex-shrink-0 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-secondary gtrans-p-0 gtrans-leading-none gtrans-text-ink gtrans-transition-all hover:gtrans-border-primary hover:gtrans-text-primary"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					</header>
				)}
				<div className="gtrans-min-h-0 gtrans-flex-1 gtrans-overflow-y-auto gtrans-p-6">{children}</div>
				{footer && (
					<footer className="gtrans-flex gtrans-flex-shrink-0 gtrans-justify-end gtrans-gap-3 gtrans-border-t gtrans-border-line gtrans-px-4 gtrans-py-5">
						{footer}
					</footer>
				)}
			</div>
		</div>
	);
}

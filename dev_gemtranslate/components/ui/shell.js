import React from 'react';
import { cx } from './cx';
import { Button } from './Button';
import { __ } from '@wordpress/i18n';

/**
 * Page-level helpers, mirroring GemCRM's ui/shell.js: cards, section
 * headings, empty states, status pills, confirm modal.
 */

export const Card = ({ className = '', children, ...rest }) => (
	<div className={cx('gtrans-bg-surface gtrans-border gtrans-border-edge gtrans-rounded-lg gtrans-p-5 gtrans-shadow-gtrans gtrans-font-sans', className)} {...rest}>
		{children}
	</div>
);

export const SectionHeading = ({ className = '', children }) => (
	<h3 className={cx('gtrans-text-lg gtrans-font-semibold gtrans-text-ink gtrans-m-0 gtrans-mb-4 gtrans-font-sans gtrans-leading-tight', className)}>{children}</h3>
);

export const EmptyState = ({ title, hint, action }) => (
	<div className="gtrans-flex gtrans-flex-col gtrans-items-center gtrans-justify-center gtrans-text-center gtrans-py-12 gtrans-px-6 gtrans-bg-surface gtrans-border gtrans-border-edge gtrans-rounded-lg gtrans-shadow-gtrans gtrans-font-sans">
		<p className="gtrans-text-ink gtrans-font-semibold gtrans-text-base gtrans-m-0">{title}</p>
		{hint && <p className="gtrans-text-muted gtrans-text-sm gtrans-mt-2 gtrans-max-w-md gtrans-m-0">{hint}</p>}
		{action && <div className="gtrans-mt-5">{action}</div>}
	</div>
);

/** Soft background + matching text color. Falls back to muted gray for unknown tones. */
const TONES = {
	draft: 'gtrans-bg-body gtrans-text-muted',
	pending: 'gtrans-bg-warning-light gtrans-text-warning',
	translated: 'gtrans-bg-success-light gtrans-text-success',
	publish: 'gtrans-bg-success-light gtrans-text-success',
	active: 'gtrans-bg-success-light gtrans-text-success',
	inactive: 'gtrans-bg-body gtrans-text-muted',
	failed: 'gtrans-bg-danger-light gtrans-text-danger',
	open: 'gtrans-bg-primary-light gtrans-text-primary',
	closed: 'gtrans-bg-body gtrans-text-muted',
	none: 'gtrans-bg-body gtrans-text-muted',
};

export const StatusBadge = ({ status }) => {
	const tone = TONES[status] || TONES.none;
	return (
		<span className={cx('gtrans-inline-flex gtrans-items-center gtrans-px-2 gtrans-py-0.5 gtrans-rounded gtrans-text-11 gtrans-font-medium gtrans-font-sans gtrans-uppercase gtrans-tracking-wide', tone)}>
			{status}
		</span>
	);
};

export const ConfirmModal = ({ message, onConfirm, onCancel, confirmLabel = __('Confirm', 'gemtranslate'), cancelLabel = __('Cancel', 'gemtranslate'), confirmVariant = 'primary' }) => (
	<div className="gtrans-fixed gtrans-inset-0 gtrans-z-[1000] gtrans-flex gtrans-items-center gtrans-justify-center gtrans-bg-black/40 gtrans-font-sans" onClick={onCancel}>
		<div className="gtrans-bg-surface gtrans-rounded-lg gtrans-shadow-xl gtrans-w-full gtrans-max-w-sm gtrans-mx-4 gtrans-p-6" onClick={(e) => e.stopPropagation()}>
			<p className="gtrans-text-ink gtrans-text-sm gtrans-mb-6 gtrans-leading-relaxed">{message}</p>
			<div className="gtrans-flex gtrans-gap-2 gtrans-justify-end">
				<Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
				<Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
			</div>
		</div>
	</div>
);

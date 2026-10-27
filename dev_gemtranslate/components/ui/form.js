import React from 'react';
import { cx } from './cx';

/**
 * Form controls, mirroring GemCRM's ui/form.js look: 40px tall, 12px
 * h-padding, 4px radius, 1px line border, primary border on hover/focus, no
 * focus ring.
 */
const fieldBase =
	'gtrans-block gtrans-w-full gtrans-rounded gtrans-border gtrans-border-line gtrans-bg-surface gtrans-text-sm gtrans-text-ink gtrans-font-sans ' +
	'placeholder:gtrans-text-placeholder hover:gtrans-border-primary focus:gtrans-border-primary ' +
	'focus:gtrans-outline-none focus:gtrans-ring-0 gtrans-transition-colors disabled:gtrans-opacity-60 disabled:gtrans-cursor-not-allowed';

export const Input = React.forwardRef(({ className = '', ...rest }, ref) => (
	<input ref={ref} className={cx(fieldBase, 'gtrans-h-10 gtrans-px-3', className)} {...rest} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className = '', rows = 4, ...rest }, ref) => (
	<textarea
		ref={ref}
		rows={rows}
		className={cx(fieldBase, 'gtrans-py-2.5 gtrans-px-3 gtrans-leading-relaxed', className)}
		{...rest}
	/>
));
Textarea.displayName = 'Textarea';

/** Native <select> styled to match Input; browser supplies the chevron. */
export const Select = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<select ref={ref} className={cx(fieldBase, 'gtrans-h-10 gtrans-px-3 gtrans-pr-8 gtrans-cursor-pointer', className)} {...rest}>
		{children}
	</select>
));
Select.displayName = 'Select';

export const Checkbox = React.forwardRef(({ label, className = '', ...rest }, ref) => (
	<label className="gtrans-inline-flex gtrans-items-center gtrans-gap-2 gtrans-cursor-pointer gtrans-select-none gtrans-text-sm gtrans-text-ink gtrans-font-sans">
		<input
			ref={ref}
			type="checkbox"
			className={cx(
				'gtrans-w-4 gtrans-h-4 gtrans-rounded gtrans-border gtrans-border-line gtrans-text-primary gtrans-cursor-pointer',
				'focus:gtrans-outline-none focus:gtrans-ring-0 focus:gtrans-border-primary',
				className,
			)}
			{...rest}
		/>
		{label && <span>{label}</span>}
	</label>
));
Checkbox.displayName = 'Checkbox';

/** Field label. */
export const Label = ({ children, required = false, htmlFor, className = '' }) => (
	<label htmlFor={htmlFor} className={cx('gtrans-block gtrans-text-sm gtrans-font-medium gtrans-text-ink gtrans-mb-1.5 gtrans-font-sans', className)}>
		{children}
		{required && <span className="gtrans-text-danger gtrans-ml-0.5">*</span>}
	</label>
);

/** Field — label + control + optional helper/error text. */
export const Field = ({ label, required, error, helper, htmlFor, children, className = '' }) => (
	<div className={cx('gtrans-font-sans', className)}>
		{label && <Label htmlFor={htmlFor} required={required}>{label}</Label>}
		{children}
		{error
			? <p className="gtrans-m-0 gtrans-mt-1 gtrans-text-xs gtrans-text-danger">{error}</p>
			: helper
				? <p className="gtrans-m-0 gtrans-mt-1 gtrans-text-xs gtrans-text-muted">{helper}</p>
				: null}
	</div>
);

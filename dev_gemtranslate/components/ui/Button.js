import React from 'react';
import { cx } from './cx';

/**
 * Button variants, mirroring GemCRM's ui/Button.js palette and sizing 1:1:
 *   primary   — bg primary, hover opacity 0.9
 *   secondary — surface bg, ink text, primary border/text on hover
 *   light     — primary-light bg, primary text
 *   danger    — outline danger
 *   success   — solid success
 *   ghost     — transparent, no border
 */
const VARIANTS = {
	primary: 'gtrans-bg-primary gtrans-text-white gtrans-border gtrans-border-primary hover:gtrans-opacity-90 gtrans-border-none',
	secondary: 'gtrans-bg-surface gtrans-border gtrans-border-line gtrans-text-ink hover:gtrans-border-primary hover:gtrans-text-primary',
	light: 'gtrans-bg-primary-light gtrans-border gtrans-border-primary-light gtrans-text-primary hover:gtrans-opacity-90 gtrans-border-none',
	danger: 'gtrans-bg-surface gtrans-border gtrans-border-line gtrans-text-danger hover:gtrans-bg-danger-light hover:gtrans-border-danger',
	success: 'gtrans-bg-success gtrans-text-white gtrans-border gtrans-border-success hover:gtrans-opacity-90',
	ghost: 'gtrans-bg-transparent gtrans-border gtrans-border-transparent gtrans-text-muted hover:gtrans-bg-body hover:gtrans-text-ink',
};

const SIZES = {
	sm: 'gtrans-h-8 gtrans-px-3 gtrans-text-xs',
	md: 'gtrans-h-10 gtrans-px-4 gtrans-text-sm',
	lg: 'gtrans-h-12 gtrans-px-6 gtrans-text-base',
};

const Spinner = () => (
	<span className="gtrans-inline-block gtrans-w-4 gtrans-h-4 gtrans-border-2 gtrans-border-current gtrans-border-t-transparent gtrans-rounded-full gtrans-animate-spin" />
);

export const Button = React.forwardRef(
	({ as: Tag = 'button', variant = 'secondary', size = 'md', className = '', children, type = 'button', loading = false, disabled, ...rest }, ref) => {
		const tagProps = Tag === 'button' ? { type, disabled: disabled || loading } : {};
		return (
			<Tag
				ref={ref}
				{...tagProps}
				className={cx(
					'gtrans-relative gtrans-inline-flex gtrans-items-center gtrans-cursor-pointer gtrans-justify-center gtrans-gap-2 gtrans-rounded gtrans-font-medium gtrans-font-sans gtrans-transition-colors',
					'disabled:gtrans-opacity-50 disabled:gtrans-cursor-not-allowed gtrans-no-underline hover:gtrans-no-underline',
					VARIANTS[variant] || VARIANTS.secondary,
					SIZES[size] || SIZES.md,
					className,
				)}
				{...rest}
			>
				<span className={cx('gtrans-inline-flex gtrans-items-center gtrans-gap-2', loading && 'gtrans-invisible')}>
					{children}
				</span>
				{loading && (
					<span className="gtrans-absolute gtrans-inset-0 gtrans-inline-flex gtrans-items-center gtrans-justify-center">
						<Spinner />
					</span>
				)}
			</Tag>
		);
	},
);
Button.displayName = 'Button';

/** Square icon-only button. */
export const IconButton = React.forwardRef(
	({ variant = 'ghost', size = 'md', className = '', children, icon, type = 'button', 'aria-label': ariaLabel, ...rest }, ref) => {
		const dim = size === 'sm' ? 'gtrans-h-8 gtrans-w-8' : size === 'lg' ? 'gtrans-h-12 gtrans-w-12' : 'gtrans-h-10 gtrans-w-10';
		return (
			<button
				ref={ref}
				type={type}
				aria-label={ariaLabel}
				className={cx(
					'gtrans-inline-flex gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-font-sans gtrans-transition-colors',
					'disabled:gtrans-opacity-50 disabled:gtrans-cursor-not-allowed',
					VARIANTS[variant] || VARIANTS.ghost,
					dim,
					className,
				)}
				{...rest}
			>
				{icon || children}
			</button>
		);
	},
);
IconButton.displayName = 'IconButton';

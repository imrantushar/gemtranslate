import React from 'react';
import { cx } from './cx';

/**
 * Layout primitives, mirroring GemCRM's ui/layout.js. className-first:
 * callers pass Tailwind utilities via `className`; dynamic values use the
 * native `style` prop.
 */

export const Box = React.forwardRef(({ as: As = 'div', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={className} {...rest}>{children}</As>
));
Box.displayName = 'Box';

export const Flex = React.forwardRef(({ as: As = 'div', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={cx('gtrans-flex', className)} {...rest}>{children}</As>
));
Flex.displayName = 'Flex';

export const Center = React.forwardRef(({ as: As = 'div', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={cx('gtrans-flex gtrans-items-center gtrans-justify-center', className)} {...rest}>{children}</As>
));
Center.displayName = 'Center';

export const VStack = React.forwardRef(({ as: As = 'div', gap = '3', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={cx('gtrans-flex gtrans-flex-col', `gtrans-gap-${gap}`, className)} {...rest}>{children}</As>
));
VStack.displayName = 'VStack';

export const HStack = React.forwardRef(({ as: As = 'div', gap = '3', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={cx('gtrans-flex gtrans-flex-row gtrans-items-center', `gtrans-gap-${gap}`, className)} {...rest}>{children}</As>
));
HStack.displayName = 'HStack';

export const Stack = VStack;

/** Divider (matches .gemcrm row-divider look). */
export const Separator = ({ orientation = 'horizontal', className = '' }) => (
	<div
		role="separator"
		className={cx(
			orientation === 'vertical' ? 'gtrans-w-px gtrans-self-stretch' : 'gtrans-h-px gtrans-w-full',
			'gtrans-bg-line',
			className,
		)}
	/>
);

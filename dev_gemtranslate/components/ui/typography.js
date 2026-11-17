import React from 'react';
import { cx } from './cx';

/**
 * Typography primitives, mirroring GemCRM's ui/typography.js. `className`
 * carries size/weight/color; these just reset margin and set the base font.
 */

export const Text = React.forwardRef(({ as: As = 'p', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={cx('gtrans-m-0 gtrans-font-sans', className)} {...rest}>{children}</As>
));
Text.displayName = 'Text';

export const Span = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<span ref={ref} className={cx('gtrans-font-sans', className)} {...rest}>{children}</span>
));
Span.displayName = 'Span';

export const Heading = React.forwardRef(({ as: As = 'h3', className = '', children, ...rest }, ref) => (
	<As ref={ref} className={cx('gtrans-m-0 gtrans-font-sans gtrans-font-semibold gtrans-text-ink', className)} {...rest}>{children}</As>
));
Heading.displayName = 'Heading';

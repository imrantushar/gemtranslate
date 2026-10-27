import React from 'react';
import { cx } from './cx';
import { __ } from '@wordpress/i18n';
import { useThemeMode } from '../../lib/theme';

/**
 * Table — mirrors GemCRM's ui/Table.js: plain semantic table elements with
 * the GemCRM list-table look (grey header band, 1px row lines, bold dark
 * headers, 12px cell padding). Usage:
 *   <Table.Root><Table.Header><Table.Row><Table.ColumnHeader>…
 *   <Table.Body><Table.Row><Table.Cell>…
 */
const Root = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<table ref={ref} className={cx('gtrans-w-full gtrans-border-collapse gtrans-text-sm gtrans-font-sans gtrans-text-ink', className)} {...rest}>
		{children}
	</table>
));
Root.displayName = 'Table.Root';

const Header = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<thead ref={ref} className={cx('[&_tr]:gtrans-border-b-0', className)} {...rest}>{children}</thead>
));
Header.displayName = 'Table.Header';

const Body = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<tbody ref={ref} className={className} {...rest}>{children}</tbody>
));
Body.displayName = 'Table.Body';

const Row = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<tr ref={ref} className={cx('gtrans-border-b gtrans-border-line hover:gtrans-bg-secondary', className)} {...rest}>{children}</tr>
));
Row.displayName = 'Table.Row';

const ColumnHeader = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<th ref={ref} className={cx('gtrans-bg-body gtrans-px-3 gtrans-py-3.5 gtrans-text-left gtrans-text-sm gtrans-font-semibold gtrans-text-ink gtrans-whitespace-nowrap first:gtrans-rounded-l last:gtrans-rounded-r', className)} {...rest}>
		{children}
	</th>
));
ColumnHeader.displayName = 'Table.ColumnHeader';

const Cell = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<td ref={ref} className={cx('gtrans-px-3 gtrans-py-3 gtrans-align-middle', className)} {...rest}>{children}</td>
));
Cell.displayName = 'Table.Cell';

/** Horizontal scroll container, wraps Table.Root. */
const ScrollArea = ({ className = '', children, ...rest }) => (
	<div className={cx('gtrans-w-full gtrans-overflow-x-auto', className)} {...rest}>{children}</div>
);

/** GemCRM-style list footer: result count on the left, pager/actions on the right. */
const Footer = ({ children, className = '', ...rest }) => (
	<div className={cx('gtrans-mt-3 gtrans-flex gtrans-items-center gtrans-justify-between gtrans-gap-4 gtrans-text-sm', className)} {...rest}>
		{children}
	</div>
);

/**
 * Toolbar above the table, separated from it by a line like GemCRM's
 * sub-header. `variant="search"` is a lone search field: left-aligned, no
 * divider, tight spacing. `variant="tabs"` is for a StatusTabs row on the left (its
 * underline overlaps the line); either way, extra controls go on the right.
 */
const Toolbar = ({ as: Tag = 'div', variant, className = '', children, ...rest }) => (
	<Tag
		className={cx(
			'gtrans-flex gtrans-flex-wrap gtrans-justify-between gtrans-gap-3',
			variant === 'search'
				? 'gtrans-mb-4 gtrans-items-center'
				: 'gtrans-mb-6 gtrans-border-b gtrans-border-line',
			variant === 'tabs' && 'gtrans-items-center',
			!variant && 'gtrans-items-end gtrans-pb-4',
			className,
		)}
		{...rest}
	>
		{children}
	</Tag>
);

/**
 * Empty state shown in place of a table with no rows — the GemCRM
 * "No Data Available!!!" illustration, heading and a one-line hint (children).
 * Pass `columns` (header labels) to keep the table's header band above it, as GemCRM does.
 */
const Empty = ({ title, columns = [], children, className = '' }) => {
	const { isDark } = useThemeMode();
	const file = isDark ? 'dark-NoDataAvailable.svg' : 'NoDataAvailable.svg';
	const base = window.gtrans?.pluginUrl || '';

	return (
		<div className={cx('gtrans-text-center', className)}>
			{columns.length > 0 && (
				<table className="gtrans-w-full gtrans-border-collapse gtrans-text-left gtrans-text-sm">
					<thead>
						<tr>
							{columns.map((label, i) => (
								<th
									key={i}
									className="gtrans-whitespace-nowrap gtrans-bg-body gtrans-px-3 gtrans-py-3.5 gtrans-text-left gtrans-text-sm gtrans-font-semibold gtrans-text-ink first:gtrans-rounded-l last:gtrans-rounded-r"
								>
									{label}
								</th>
							))}
						</tr>
					</thead>
				</table>
			)}
			<img
				src={`${base}assets/images/${file}`}
				alt=""
				className="gtrans-mx-auto gtrans-h-auto gtrans-max-w-full"
			/>
			<h3 className="gtrans-m-0 gtrans-pt-3 gtrans-text-2xl gtrans-font-medium gtrans-leading-9 gtrans-text-ink">
				{title || __('No Data Available!!!', 'gemtranslate')}
			</h3>
			{children && (
				<p className="gtrans-m-0 gtrans-pt-1 gtrans-text-sm gtrans-text-ink">{children}</p>
			)}
		</div>
	);
};

export const Table = { Root, Header, Body, Row, ColumnHeader, Cell, ScrollArea, Footer, Toolbar, Empty };

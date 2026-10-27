import React from 'react';
import { cx } from './cx';

/**
 * Table — mirrors GemCRM's ui/Table.js: plain semantic table elements with
 * the GemCRM list-table look (1px lines, bold dark headers, 12px cell
 * padding). Usage:
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
	<thead ref={ref} className={cx('gtrans-border-b gtrans-border-line', className)} {...rest}>{children}</thead>
));
Header.displayName = 'Table.Header';

const Body = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<tbody ref={ref} className={className} {...rest}>{children}</tbody>
));
Body.displayName = 'Table.Body';

const Row = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<tr ref={ref} className={cx('gtrans-border-b gtrans-border-line', className)} {...rest}>{children}</tr>
));
Row.displayName = 'Table.Row';

const ColumnHeader = React.forwardRef(({ className = '', children, ...rest }, ref) => (
	<th ref={ref} className={cx('gtrans-px-3 gtrans-py-3.5 gtrans-text-left gtrans-text-sm gtrans-font-semibold gtrans-text-ink gtrans-whitespace-nowrap gtrans-bg-body', className)} {...rest}>
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

export const Table = { Root, Header, Body, Row, ColumnHeader, Cell, ScrollArea };

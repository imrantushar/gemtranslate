import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import SidebarLayout, { SidebarNav, Panel } from '../../components/SidebarLayout';
import { useSubmenus } from '../../components/nav';
import StatusPill from '../../components/StatusPill';
import SearchBox from '../../components/SearchBox';
import StatusTabs from '../../components/StatusTabs';
import { Table } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/Skeleton';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import { usePatternItems } from '../../hooks/usePatterns';
import { truncate } from '../../lib/format';

export const editUrl = (id, lang = '') => `/patterns/edit?item=${encodeURIComponent(id)}${lang ? `&lang=${lang}` : ''}`;

const percent = (done, total) => (total > 0 ? Math.round((done / total) * 100) : 0);

/** All texts translated in every language / none in any / somewhere in between. */
function overallStatus(row, langCodes) {
	const done = langCodes.reduce((n, c) => n + (row.progress?.[c] || 0), 0);
	if (done === 0) return 'untranslated';
	return langCodes.every((c) => (row.progress?.[c] || 0) >= row.total) ? 'translated' : 'progress';
}

/**
 * Header, footer, synced patterns and navigation menus of a block theme, laid
 * out like Posts & Pages: content types in the sidebar, status tabs and search
 * over a table with one progress column per language.
 */
export default function PatternsPage() {
	const [filters, setFilters] = useState({ page: 1, per_page: 20, search: '', status: 'all' });
	const [params, setParams] = useSearchParams();
	const { patterns } = useSubmenus();
	const type = params.get('type') || patterns[0]?.key || 'template_part';
	const items = usePatternItems();

	const rows = items.data?.rows || [];
	const langCodes = items.data?.meta?.languages || [];

	// Switching content type starts a fresh list.
	useEffect(() => {
		setFilters((f) => ({ ...f, page: 1, status: 'all' }));
	}, [type]);

	const ofType = useMemo(() => rows.filter((r) => r.type === type), [rows, type]);
	const counts = useMemo(() => {
		const c = { all: ofType.length, untranslated: 0, progress: 0, translated: 0 };
		// Without a non-default language nothing can be translated, and the list
		// below is an empty state: don't advertise items that aren't shown.
		if (langCodes.length === 0) return { ...c, all: 0 };
		ofType.forEach((r) => { c[overallStatus(r, langCodes)] += 1; });
		return c;
	}, [ofType, langCodes]);

	const q = filters.search.trim().toLowerCase();
	const filtered = ofType.filter(
		(r) =>
			(filters.status === 'all' || overallStatus(r, langCodes) === filters.status) &&
			(!q || r.title.toLowerCase().includes(q))
	);
	const pageRows = filtered.slice((filters.page - 1) * filters.per_page, filters.page * filters.per_page);
	const section = patterns.find((t) => t.key === type);

	return (
		<SidebarLayout
			nav={
				<SidebarNav
					label={__('Pattern types', 'gemtranslate')}
					items={patterns}
					active={type}
					onSelect={(key) => setParams({ type: key })}
				/>
			}
		>
			<Panel
				title={section?.label || __('Patterns', 'gemtranslate')}
				description={__(
					'Pick one to translate it into your active languages. A text is translated once and applies everywhere it appears.',
					'gemtranslate'
				)}
			>
				<Table.Toolbar variant="tabs">
					<StatusTabs
						value={filters.status}
						onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
						tabs={[
							{ value: 'all', label: __('All', 'gemtranslate'), count: counts.all },
							{ value: 'untranslated', label: __('Untranslated', 'gemtranslate'), count: counts.untranslated },
							{ value: 'progress', label: __('In progress', 'gemtranslate'), count: counts.progress },
							{ value: 'translated', label: __('Translated', 'gemtranslate'), count: counts.translated },
						]}
					/>
					<SearchBox
						value={filters.search}
						placeholder={__('Search by name…', 'gemtranslate')}
						onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
					/>
				</Table.Toolbar>

				{items.isLoading ? (
					<TableSkeleton />
				) : langCodes.length === 0 ? (
					<Table.Empty
						columns={[__('Name', 'gemtranslate'), '']}
						title={__('No language to translate into yet', 'gemtranslate')}
					>
						{__('Add at least one non-default language to start translating patterns.', 'gemtranslate')}{' '}
						<Link to="/languages" className="gtrans-font-medium gtrans-text-primary">
							{__('Add a language', 'gemtranslate')}
						</Link>
					</Table.Empty>
				) : filtered.length === 0 ? (
					<Table.Empty columns={[__('Name', 'gemtranslate'), __('Texts', 'gemtranslate'), '']}>
						{ofType.length === 0
							? window.gtrans?.isClassic
								? __('Nothing to translate here. Add text widgets to a sidebar (Appearance → Widgets) or set a site title and tagline.', 'gemtranslate')
								: __('Nothing to translate here. This needs a block theme with text in its template parts, patterns or navigation.', 'gemtranslate')
							: __('No matches.', 'gemtranslate')}
					</Table.Empty>
				) : (
					<Table.ScrollArea>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.ColumnHeader>{__('Name', 'gemtranslate')}</Table.ColumnHeader>
									<Table.ColumnHeader>{__('Texts', 'gemtranslate')}</Table.ColumnHeader>
									{langCodes.map((code) => (
										<Table.ColumnHeader key={code}>{code.toUpperCase()}</Table.ColumnHeader>
									))}
									<Table.ColumnHeader />
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{pageRows.map((row) => (
									<Table.Row key={row.id}>
										<Table.Cell className="gtrans-max-w-[360px]">
											<div className="gtrans-font-medium gtrans-text-ink">{truncate(row.title, 60)}</div>
											{row.detail && <div className="gtrans-text-xs gtrans-text-muted">{row.detail}</div>}
										</Table.Cell>
										<Table.Cell>{row.total}</Table.Cell>
										{langCodes.map((code) => {
											const done = row.progress?.[code] || 0;
											const pct = percent(done, row.total);
											return (
												<Table.Cell key={code}>
													<StatusPill tone={pct >= 100 ? 'translated' : pct > 0 ? 'pending' : 'none'}>
														{pct > 0 ? `${pct}%` : '—'}
													</StatusPill>
												</Table.Cell>
											);
										})}
										<Table.Cell className="gtrans-text-right">
											<Button as={Link} to={editUrl(row.id)} variant="primary" size="sm">
												{__('Translate', 'gemtranslate')}
											</Button>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Root>
					</Table.ScrollArea>
				)}

				{!items.isLoading && filtered.length > 0 && (
					<Pagination
						total={filtered.length}
						shown={pageRows.length}
						page={filters.page}
						perPage={filters.per_page}
						onPage={(page) => setFilters((f) => ({ ...f, page }))}
						onPerPage={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
					/>
				)}
			</Panel>
		</SidebarLayout>
	);
}

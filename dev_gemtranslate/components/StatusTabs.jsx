import clsx from 'clsx';

/**
 * Status filter tabs for a list-table toolbar (GemCRM's "All / Draft /
 * Pending" row). Sits on the left of `Table.Toolbar variant="tabs"`; the
 * active tab's underline overlaps the toolbar's bottom line.
 */
export default function StatusTabs({ tabs, value, onChange }) {
	return (
		<div role="tablist" className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1">
			{tabs.map((tab) => {
				const active = tab.value === value;
				return (
					<button
						key={tab.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(tab.value)}
						className={clsx(
							'gtrans-bare gtrans-flex gtrans-cursor-pointer gtrans-items-center gtrans-gap-2 gtrans-border-0 gtrans-border-b-2 gtrans-bg-transparent gtrans-px-3.5 gtrans-py-3 gtrans-text-sm gtrans-font-medium gtrans-transition-colors',
							active
								? 'gtrans-border-ink gtrans-text-ink'
								: 'gtrans-border-transparent gtrans-text-muted hover:gtrans-text-ink'
						)}
						style={{ borderBottomStyle: 'solid', marginBottom: -1 }}
					>
						{tab.label}
						{typeof tab.count === 'number' && (
							<span
								className={clsx(
									'gtrans-rounded gtrans-px-1.5 gtrans-text-2xs',
									active ? 'gtrans-bg-primary-light gtrans-text-primary' : 'gtrans-bg-body gtrans-text-muted'
								)}
							>
								{tab.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

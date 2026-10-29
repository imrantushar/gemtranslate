import clsx from 'clsx';
import { __ } from '@wordpress/i18n';

import Icon from './Icon';

/**
 * Left navigation: icon, label and a one-line hint per entry. Horizontal and
 * scrollable below the `lg` breakpoint.
 */
export function SidebarNav({ items, active, onSelect, label }) {
	return (
		<nav
			aria-label={label || __('Sections', 'gemtranslate')}
			className="gtrans-flex gtrans-gap-1 gtrans-overflow-x-auto lg:gtrans-flex-col"
		>
			{items.map((t) => {
				const on = t.key === active;
				return (
					<button
						key={t.key}
						type="button"
						onClick={() => onSelect(t.key)}
						aria-current={on ? 'page' : undefined}
						className={clsx(
							'gtrans-bare gtrans-flex gtrans-flex-shrink-0 gtrans-cursor-pointer gtrans-items-center gtrans-gap-3 gtrans-rounded-lg gtrans-border-0 gtrans-px-3 gtrans-py-2.5 gtrans-text-left lg:gtrans-w-full',
							on ? 'gtrans-bg-navactive gtrans-text-primary' : 'gtrans-bg-transparent gtrans-text-description hover:gtrans-bg-body'
						)}
					>
						{t.icon && <Icon name={t.icon} size={18} />}
						<span className="gtrans-min-w-0">
							<span className={clsx('gtrans-block gtrans-text-sm gtrans-font-semibold', !on && 'gtrans-text-ink')}>{t.label}</span>
							{t.hint && <span className="gtrans-block gtrans-text-xs">{t.hint}</span>}
						</span>
					</button>
				);
			})}
		</nav>
	);
}

/**
 * Right panel: heading and description (with optional actions beside them), a
 * rule, then the content. `divided` separates direct children with hairlines,
 * which is what settings rows want; tables bring their own.
 */
export function Panel({ title, description, actions, divided = false, children }) {
	return (
		<section className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-6 gtrans-shadow-gtrans">
			<div className="gtrans-flex gtrans-flex-wrap gtrans-items-start gtrans-justify-between gtrans-gap-3">
				<div>
					<h2 className="gtrans-m-0 gtrans-text-xl gtrans-font-semibold gtrans-text-heading">{title}</h2>
					{description && (
						<p className="gtrans-mb-0 gtrans-mt-1 gtrans-text-sm gtrans-text-description">{description}</p>
					)}
				</div>
				{actions}
			</div>
			<div
				className={clsx(
					'gtrans-mt-5 gtrans-border-0 gtrans-border-t gtrans-border-solid gtrans-border-divider',
					divided && 'gtrans-divide-y gtrans-divide-solid gtrans-divide-divider'
				)}
			>
				{children}
			</div>
		</section>
	);
}

/** Sidebar on the left, content on the right; stacks on narrow screens. */
export default function SidebarLayout({ nav, children }) {
	return (
		<div className="gtrans-grid gtrans-items-start gtrans-gap-6 lg:gtrans-grid-cols-[280px_1fr]">
			<div className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-3 gtrans-shadow-gtrans">
				{nav}
			</div>
			<div className="gtrans-min-w-0">{children}</div>
		</div>
	);
}

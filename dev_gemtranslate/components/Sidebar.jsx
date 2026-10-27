import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

import LanguagePicker from './LanguagePicker';
import { useJobCounts } from '../hooks/useJobs';
import { useReviewCount } from '../hooks/useReview';
import { useAssignmentCounts } from '../hooks/useAssignments';
import { hasFeature } from '../hooks/useFeatures';
import { ProBadge } from './ProGate';
import Icon from './Icon';
import { usePostTypes } from '../hooks/usePostTypes';

export const NAV = [
	{ to: '/dashboard', label: () => __('Dashboard', 'gemtranslate'), icon: 'dashboard' },
	{ to: '/languages', label: () => __('Languages', 'gemtranslate'), icon: 'globe' },
	{ to: '/posts', label: () => __('Posts & Pages', 'gemtranslate'), icon: 'file', children: 'postTypes' },
	{
		to: '/review',
		label: () => __('Review', 'gemtranslate'),
		icon: 'check',
		badge: 'review',
		pro: 'translate_everything',
	},
	{ to: '/terms', label: () => __('Taxonomies', 'gemtranslate'), icon: 'tag', children: 'taxonomies' },
	{ to: '/strings', label: () => __('Strings', 'gemtranslate'), icon: 'type' },
	{ to: '/menus', label: () => __('Menus', 'gemtranslate'), icon: 'menu' },
	{ to: '/seo', label: () => __('SEO', 'gemtranslate'), icon: 'search', pro: 'seo_advanced' },
	{ to: '/ai', label: () => __('AI Translation', 'gemtranslate'), icon: 'sparkles' },
	{ to: '/glossary', label: () => __('Glossary', 'gemtranslate'), icon: 'book', pro: 'glossary' },
	{
		to: '/jobs',
		label: () => __('Jobs', 'gemtranslate'),
		icon: 'clock',
		badge: 'jobs',
		pro: 'ai_bulk',
	},
	{
		to: '/assignments',
		label: () => __('Assignments', 'gemtranslate'),
		icon: 'clipboard',
		pro: 'translators',
		badge: 'assignments',
	},
	{
		to: '/translators',
		label: () => __('Translators', 'gemtranslate'),
		icon: 'users',
		pro: 'translators',
	},
	{ to: '/migration', label: () => __('Migration', 'gemtranslate'), icon: 'swap' },
	{
		to: '/io',
		label: () => __('Import & Export', 'gemtranslate'),
		icon: 'upload',
		pro: 'import_export',
	},
	{ to: '/settings', label: () => __('Settings', 'gemtranslate'), icon: 'settings' },
];


// Submenu entries for the expandable items. Post types come from the API;
// taxonomies are fixed, with the WooCommerce ones shown only when "product"
// is a registered type.
function useSubmenus() {
	const postTypes = usePostTypes();
	const types = postTypes.data || [];

	const posts = (
		types.length
			? types.map((t) => ({ key: t.name, label: t.label }))
			: [
					{ key: 'post', label: __('Posts', 'gemtranslate') },
					{ key: 'page', label: __('Pages', 'gemtranslate') },
				]
	).map((c) => ({ ...c, to: `/posts?type=${c.key}`, param: 'type', isDefault: c.key === 'post' }));

	const taxonomies = [
		{ key: 'category', label: __('Categories', 'gemtranslate') },
		{ key: 'post_tag', label: __('Tags', 'gemtranslate') },
		...(types.some((t) => t.name === 'product')
			? [
					{ key: 'product_cat', label: __('Product categories', 'gemtranslate') },
					{ key: 'product_tag', label: __('Product tags', 'gemtranslate') },
				]
			: []),
	].map((c) => ({ ...c, to: `/terms?tax=${c.key}`, param: 'tax', isDefault: c.key === 'category' }));

	return { postTypes: posts, taxonomies };
}

function SubMenu({ items }) {
	const { search } = useLocation();
	const params = new URLSearchParams(search);

	return (
		<div className="gtrans-ml-5 gtrans-mt-1 gtrans-flex gtrans-flex-col gtrans-gap-0.5 gtrans-border-l gtrans-border-edge gtrans-pl-3">
			{items.map((child) => {
				const current = params.get(child.param);
				const active = current ? current === child.key : child.isDefault;
				return (
					<Link
						key={child.key}
						to={child.to}
						className={clsx(
							'gtrans-rounded gtrans-px-3 gtrans-py-1.5 gtrans-text-sm gtrans-no-underline gtrans-transition-colors',
							active
								? 'gtrans-bg-navactive gtrans-font-medium gtrans-text-primary'
								: 'gtrans-text-label hover:gtrans-bg-body'
						)}
						aria-current={active ? 'page' : undefined}
					>
						{child.label}
					</Link>
				);
			})}
		</div>
	);
}

export default function Sidebar({ collapsed = false }) {
	const counts = useJobCounts();
	const liveJobs = (counts.data?.pending ?? 0) + (counts.data?.running ?? 0);
	const reviewCount = useReviewCount();
	const pendingReview = reviewCount.data ?? 0;
	const assignmentCounts = useAssignmentCounts();
	const openAssignments = assignmentCounts.data?.open ?? 0;
	const submenus = useSubmenus();
	const { pathname } = useLocation();
	const [open, setOpen] = useState({});

	return (
		<aside
			className={clsx(
				'gtrans-flex-shrink-0 gtrans-border-r gtrans-border-edge gtrans-bg-surface gtrans-py-4 gtrans-transition-all gtrans-duration-200',
				collapsed ? 'gtrans-w-16 gtrans-px-2' : 'gtrans-w-60 gtrans-px-3'
			)}
		>
			{!collapsed && <LanguagePicker />}

			<nav className={clsx('gtrans-flex gtrans-flex-col gtrans-gap-1', !collapsed && 'gtrans-mt-4')}>
				{NAV.map((item) => {
					const kids = item.children && !collapsed ? submenus[item.children] : null;
					const isOpen = kids ? open[item.to] ?? pathname.startsWith(item.to) : false;
					return (
					<div key={item.to}>
					<div className="gtrans-relative">
					<NavLink
						to={item.to}
						title={collapsed ? item.label() : undefined}
						className={({ isActive }) =>
							clsx(
								'gtrans-relative gtrans-flex gtrans-items-center gtrans-gap-3 gtrans-rounded gtrans-py-2 gtrans-text-sm gtrans-no-underline gtrans-transition-colors',
								collapsed ? 'gtrans-justify-center gtrans-px-0' : 'gtrans-px-3',
								isActive
									? kids
										? 'gtrans-nav-parent gtrans-text-primary gtrans-font-medium'
										: 'gtrans-bg-navactive gtrans-text-primary gtrans-font-medium'
									: 'gtrans-text-label hover:gtrans-bg-body'
							)
						}
					>
						<Icon name={item.icon} />
						{collapsed ? (
							<span className="gtrans-sr-only">{item.label()}</span>
						) : (
							<>
						<span className="gtrans-flex-1">{item.label()}</span>
						{item.badge === 'jobs' && liveJobs > 0 && (
							<span className="gtrans-rounded-full gtrans-bg-primary-light gtrans-px-2 gtrans-py-0.5 gtrans-text-11 gtrans-font-medium gtrans-text-primary">
								{liveJobs}
							</span>
						)}
						{item.badge === 'review' && pendingReview > 0 && (
							<span className="gtrans-rounded-full gtrans-bg-warning-light gtrans-px-2 gtrans-py-0.5 gtrans-text-11 gtrans-font-medium gtrans-text-warning">
								{pendingReview}
							</span>
						)}
						{item.badge === 'assignments' && openAssignments > 0 && (
							<span className="gtrans-rounded-full gtrans-bg-primary-light gtrans-px-2 gtrans-py-0.5 gtrans-text-11 gtrans-font-medium gtrans-text-primary">
								{openAssignments}
							</span>
						)}
						{item.pro && !hasFeature(item.pro) && <ProBadge />}
							</>
						)}
					</NavLink>
					{kids && (
						<button
							type="button"
							onClick={() => setOpen((o) => ({ ...o, [item.to]: !isOpen }))}
							aria-label={isOpen ? __('Collapse submenu', 'gemtranslate') : __('Expand submenu', 'gemtranslate')}
							aria-expanded={isOpen}
							className="gtrans-bare gtrans-absolute gtrans-right-1 gtrans-top-1/2 gtrans--translate-y-1/2 gtrans-flex gtrans-h-7 gtrans-w-7 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-text-muted hover:gtrans-text-ink"
						>
							<span className={clsx('gtrans-flex gtrans-transition-transform', isOpen && 'gtrans-rotate-90')}>
								<Icon name="chevron" size={14} />
							</span>
						</button>
					)}
					</div>
					{isOpen && <SubMenu items={kids} />}
					</div>
					);
				})}
			</nav>
		</aside>
	);
}

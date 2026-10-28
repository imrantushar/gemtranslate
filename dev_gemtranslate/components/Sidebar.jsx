import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

import { useAssignmentCounts } from '../hooks/useAssignments';
import { hasFeature } from '../hooks/useFeatures';
import { ProBadge } from './ProGate';
import Icon from './Icon';
import MenuToggle from './MenuToggle';
import { usePostTypes } from '../hooks/usePostTypes';

export const NAV = [
	{ to: '/dashboard', label: () => __('Dashboard', 'gemtranslate'), icon: 'dashboard' },
	{ to: '/languages', label: () => __('Languages', 'gemtranslate'), icon: 'globe' },
	{ to: '/posts', label: () => __('Posts & Pages', 'gemtranslate'), icon: 'file', children: 'postTypes' },
	{ to: '/terms', label: () => __('Taxonomies', 'gemtranslate'), icon: 'tag', children: 'taxonomies' },
	{ to: '/strings', label: () => __('Strings', 'gemtranslate'), icon: 'type' },
	{ to: '/menus', label: () => __('Menus', 'gemtranslate'), icon: 'menu' },
	{ to: '/seo', label: () => __('SEO', 'gemtranslate'), icon: 'search', pro: 'seo_advanced' },
	{
		to: '/translators',
		label: () => __('Translators', 'gemtranslate'),
		icon: 'users',
		pro: 'translators',
		children: 'translators',
	},
	{ to: '/migration', label: () => __('Migration', 'gemtranslate'), icon: 'swap' },
	{
		to: '/io',
		label: () => __('Import & Export', 'gemtranslate'),
		icon: 'upload',
		pro: 'import_export',
	},
	{ to: '/settings', label: () => __('Settings', 'gemtranslate'), icon: 'settings', children: 'settings' },
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

	const settings = [
		{ key: 'general', label: __('General', 'gemtranslate') },
		{ key: 'switcher', label: __('Language switcher', 'gemtranslate') },
		{ key: 'geo', label: __('Country detection', 'gemtranslate') },
		{ key: 'floating', label: __('Floating switcher', 'gemtranslate') },
		{ key: 'advanced', label: __('Advanced', 'gemtranslate') },
	].map((c) => ({ ...c, to: `/settings?tab=${c.key}`, param: 'tab', isDefault: c.key === 'general' }));

	const translators = [
		{ key: 'contributor', label: __('Contributor', 'gemtranslate'), to: '/assignments', badge: 'assignments' },
	];

	return { postTypes: posts, taxonomies, settings, translators };
}

function SubMenu({ items, openAssignments }) {
	const { pathname, search } = useLocation();
	const params = new URLSearchParams(search);

	return (
		<div className="gtrans-ml-5 gtrans-mt-1 gtrans-flex gtrans-flex-col gtrans-gap-0.5 gtrans-border-l gtrans-border-edge gtrans-pl-3">
			{items.map((child) => {
				const current = child.param ? params.get(child.param) : null;
				const childPath = child.to.split('?')[0];
				const onChildPage = pathname === childPath || pathname.startsWith(`${childPath}/`);
				const active = onChildPage && (
					child.param ? (current ? current === child.key : child.isDefault) : true
				);
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
						{child.badge === 'assignments' && openAssignments > 0 && (
							<span className="gtrans-ml-2 gtrans-rounded-full gtrans-bg-primary-light gtrans-px-2 gtrans-py-0.5 gtrans-text-11 gtrans-font-medium gtrans-text-primary">
								{openAssignments}
							</span>
						)}
					</Link>
				);
			})}
		</div>
	);
}

export default function Sidebar({ collapsed = false, onToggle }) {
	const assignmentCounts = useAssignmentCounts();
	const openAssignments = assignmentCounts.data?.open ?? 0;
	const submenus = useSubmenus();
	const { pathname } = useLocation();
	const [open, setOpen] = useState({});

	return (
		<aside
			className={clsx(
				'gtrans-relative gtrans-flex-shrink-0 gtrans-border-r gtrans-border-edge gtrans-bg-surface gtrans-py-4 gtrans-transition-all gtrans-duration-200',
				collapsed ? 'gtrans-w-16 gtrans-px-2' : 'gtrans-w-60 gtrans-px-3'
			)}
		>
			{!collapsed && (
				<MenuToggle
					collapsed={collapsed}
					onToggle={onToggle}
					className="gtrans-absolute gtrans-right-3 gtrans-top-[18px] gtrans-z-10"
				/>
			)}

			<nav className="gtrans-flex gtrans-flex-col gtrans-gap-1">
				{NAV.map((item) => {
					const kids = item.children && !collapsed ? submenus[item.children] : null;
					const childPathActive = kids?.some(
						(child) => child.to && (pathname === child.to || pathname.startsWith(`${child.to}/`))
					);
					const isOpen = kids ? open[item.to] ?? (pathname.startsWith(item.to) || childPathActive) : false;
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
								isActive || childPathActive
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
					{isOpen && <SubMenu items={kids} openAssignments={openAssignments} />}
					</div>
					);
				})}
			</nav>
		</aside>
	);
}

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

import Icon from './Icon';
import { ProBadge } from './ProGate';
import { NAV, MORE_PATHS, useSubmenus } from './nav';
import { useAssignmentCounts } from '../hooks/useAssignments';
import { hasFeature } from '../hooks/useFeatures';

const ITEM =
	'gtrans-bare gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-whitespace-nowrap gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-font-medium gtrans-no-underline gtrans-transition-colors';
const ON = 'gtrans-border-primary gtrans-bg-primary-light gtrans-text-primary';
const OFF = 'gtrans-border-transparent gtrans-bg-transparent gtrans-text-label hover:gtrans-bg-surface';

function isActivePath(pathname, to) {
	return pathname === to || pathname.startsWith(`${to}/`);
}

/** Dropdown panel anchored under its trigger. */
function Panel({ children, align = 'left' }) {
	return (
		<div
			role="menu"
			className={clsx(
				'gtrans-absolute gtrans-top-full gtrans-mt-2 gtrans-min-w-[200px] gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-1.5',
				align === 'right' ? 'gtrans-right-0' : 'gtrans-left-0'
			)}
			style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200 }}
		>
			{children}
		</div>
	);
}

function MenuLink({ to, active, children }) {
	return (
		<Link
			to={to}
			role="menuitem"
			aria-current={active ? 'page' : undefined}
			className={clsx(
				'gtrans-flex gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-rounded gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-no-underline',
				active ? 'gtrans-bg-navactive gtrans-font-medium gtrans-text-primary' : 'gtrans-text-label hover:gtrans-bg-body'
			)}
		>
			{children}
		</Link>
	);
}

export default function HeaderNav() {
	const { pathname, search } = useLocation();
	const submenus = useSubmenus();
	const assignmentCounts = useAssignmentCounts();
	const openAssignments = assignmentCounts.data?.open ?? 0;
	const [openKey, setOpenKey] = useState(null);
	const wrap = useRef(null);

	// Close any open dropdown on navigation, outside click and Escape.
	useEffect(() => setOpenKey(null), [pathname, search]);
	useEffect(() => {
		const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && setOpenKey(null);
		const onKey = (e) => e.key === 'Escape' && setOpenKey(null);
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	}, []);

	const primary = NAV.filter((i) => !MORE_PATHS.includes(i.to));
	const more = NAV.filter((i) => MORE_PATHS.includes(i.to));
	const params = new URLSearchParams(search);

	const childActive = (child) => {
		const base = child.to.split('?')[0];
		if (!isActivePath(pathname, base)) return false;
		if (!child.param) return true;
		const cur = params.get(child.param);
		return cur ? cur === child.key : !!child.isDefault;
	};

	const Badge = ({ item }) =>
		item.badge === 'assignments' && openAssignments > 0 ? (
			<span className="gtrans-rounded-full gtrans-bg-primary-light gtrans-px-2 gtrans-py-0.5 gtrans-text-11 gtrans-font-medium gtrans-text-primary">
				{openAssignments}
			</span>
		) : null;

	const renderItem = (item) => {
		const kids = item.children ? submenus[item.children] : null;
		const active = isActivePath(pathname, item.to);

		if (!kids) {
			return (
				<NavLink key={item.to} to={item.to} className={clsx(ITEM, active ? ON : OFF)}>
					<Icon name={item.icon} size={16} />
					{item.label()}
					<Badge item={item} />
					{item.pro && !hasFeature(item.pro) && <ProBadge />}
				</NavLink>
			);
		}

		const open = openKey === item.to;
		return (
			<div key={item.to} className="gtrans-relative">
				<button
					type="button"
					aria-haspopup="menu"
					aria-expanded={open}
					onClick={() => setOpenKey(open ? null : item.to)}
					className={clsx(ITEM, 'gtrans-cursor-pointer', active || open ? ON : OFF)}
				>
					<Icon name={item.icon} size={16} />
					{item.label()}
					<span className={clsx('gtrans-flex gtrans-transition-transform', open ? 'gtrans--rotate-90' : 'gtrans-rotate-90')}>
						<Icon name="chevron" size={12} />
					</span>
				</button>
				{open && (
					<Panel>
						{kids.map((child) => (
							<MenuLink key={child.key} to={child.to} active={childActive(child)}>
								{child.label}
								{child.badge === 'assignments' && openAssignments > 0 && (
									<span className="gtrans-rounded-full gtrans-bg-primary-light gtrans-px-2 gtrans-py-0.5 gtrans-text-11 gtrans-font-medium gtrans-text-primary">
										{openAssignments}
									</span>
								)}
							</MenuLink>
						))}
					</Panel>
				)}
			</div>
		);
	};

	const moreOpen = openKey === '__more';
	const moreActive = more.some((i) => isActivePath(pathname, i.to));

	return (
		<nav
			ref={wrap}
			aria-label={__('GemTranslate', 'gemtranslate')}
			className="gtrans-flex gtrans-items-center gtrans-gap-1 gtrans-rounded-lg gtrans-bg-body gtrans-p-1"
		>
			{primary.map(renderItem)}
			{more.length > 0 && (
				<div className="gtrans-relative">
					<button
						type="button"
						aria-haspopup="menu"
						aria-expanded={moreOpen}
						onClick={() => setOpenKey(moreOpen ? null : '__more')}
						className={clsx(ITEM, 'gtrans-cursor-pointer', moreActive || moreOpen ? ON : OFF)}
					>
						{__('More', 'gemtranslate')}
						<span className={clsx('gtrans-flex gtrans-transition-transform', moreOpen ? 'gtrans--rotate-90' : 'gtrans-rotate-90')}>
							<Icon name="chevron" size={12} />
						</span>
					</button>
					{moreOpen && (
						<Panel align="right">
							{more.map((item) => (
								<MenuLink key={item.to} to={item.to} active={isActivePath(pathname, item.to)}>
									<span className="gtrans-flex gtrans-items-center gtrans-gap-2">
										<Icon name={item.icon} size={14} />
										{item.label()}
									</span>
									{item.pro && !hasFeature(item.pro) && <ProBadge />}
								</MenuLink>
							))}
						</Panel>
					)}
				</div>
			)}
		</nav>
	);
}

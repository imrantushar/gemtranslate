import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const NAV = [
	{ to: '/dashboard', label: 'Dashboard', icon: '◆' },
	{ to: '/languages', label: 'Languages', icon: '🌐' },
	{ to: '/posts', label: 'Posts & Pages', icon: '📝' },
	{ to: '/strings', label: 'Strings', icon: '🔤' },
	{ to: '/menus', label: 'Menus', icon: '☰' },
	{ to: '/seo', label: 'SEO', icon: '🔍' },
	{ to: '/ai', label: 'AI Translation', icon: '✨' },
	{ to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar() {
	return (
		<aside className="ztrans-w-60 ztrans-flex-shrink-0 ztrans-border-r ztrans-border-ztrans-border ztrans-bg-white ztrans-px-4 ztrans-py-6">
			<div className="ztrans-mb-8 ztrans-px-2">
				<div className="ztrans-text-lg ztrans-font-semibold ztrans-text-ztrans-primary">Zentranslate</div>
				<div className="ztrans-text-xs ztrans-text-ztrans-muted">v{window.ztrans?.version || '1.0.0'}</div>
			</div>
			<nav className="ztrans-flex ztrans-flex-col ztrans-gap-1">
				{NAV.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							clsx(
								'ztrans-flex ztrans-items-center ztrans-gap-3 ztrans-rounded-md ztrans-px-3 ztrans-py-2 ztrans-text-sm ztrans-no-underline ztrans-transition',
								isActive
									? 'ztrans-bg-ztrans-primary ztrans-text-white'
									: 'ztrans-text-gray-700 hover:ztrans-bg-gray-100'
							)
						}
					>
						<span className="ztrans-text-base" aria-hidden="true">
							{item.icon}
						</span>
						{item.label}
					</NavLink>
				))}
			</nav>
		</aside>
	);
}

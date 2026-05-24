import { NavLink } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

import LanguagePicker from './LanguagePicker';
import { useJobCounts } from '../hooks/useJobs';

const NAV = [
	{ to: '/dashboard', label: () => __('Dashboard', 'zentranslate'), icon: '◆' },
	{ to: '/languages', label: () => __('Languages', 'zentranslate'), icon: '🌐' },
	{ to: '/posts', label: () => __('Posts & Pages', 'zentranslate'), icon: '📝' },
	{ to: '/terms', label: () => __('Taxonomies', 'zentranslate'), icon: '🏷' },
	{ to: '/strings', label: () => __('Strings', 'zentranslate'), icon: '🔤' },
	{ to: '/menus', label: () => __('Menus', 'zentranslate'), icon: '☰' },
	{ to: '/seo', label: () => __('SEO', 'zentranslate'), icon: '🔍' },
	{ to: '/ai', label: () => __('AI Translation', 'zentranslate'), icon: '✨' },
	{ to: '/glossary', label: () => __('Glossary', 'zentranslate'), icon: '📖' },
	{ to: '/jobs', label: () => __('Jobs', 'zentranslate'), icon: '⏱', badge: 'jobs' },
	{ to: '/translators', label: () => __('Translators', 'zentranslate'), icon: '👥' },
	{ to: '/migration', label: () => __('Migration', 'zentranslate'), icon: '⇆' },
	{ to: '/io', label: () => __('Import & Export', 'zentranslate'), icon: '⇪' },
	{ to: '/settings', label: () => __('Settings', 'zentranslate'), icon: '⚙' },
];

export default function Sidebar() {
	const counts = useJobCounts();
	const liveJobs = (counts.data?.pending ?? 0) + (counts.data?.running ?? 0);

	return (
		<aside className="ztrans-w-60 ztrans-flex-shrink-0 ztrans-border-r ztrans-border-ztrans-border ztrans-bg-white ztrans-px-4 ztrans-py-6">
			<div className="ztrans-mb-6 ztrans-px-2">
				<div className="ztrans-text-lg ztrans-font-semibold ztrans-text-ztrans-primary">Zentranslate</div>
				<div className="ztrans-text-xs ztrans-text-ztrans-muted">v{window.ztrans?.version || '1.0.0'}</div>
			</div>

			<LanguagePicker />

			<nav className="ztrans-mt-6 ztrans-flex ztrans-flex-col ztrans-gap-1">
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
						<span className="ztrans-flex-1">{item.label()}</span>
						{item.badge === 'jobs' && liveJobs > 0 && (
							<span className="ztrans-rounded-full ztrans-bg-blue-100 ztrans-px-2 ztrans-py-0.5 ztrans-text-xs ztrans-text-blue-800">
								{liveJobs}
							</span>
						)}
					</NavLink>
				))}
			</nav>
		</aside>
	);
}

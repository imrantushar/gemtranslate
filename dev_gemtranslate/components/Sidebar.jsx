import { NavLink } from 'react-router-dom';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

import LanguagePicker from './LanguagePicker';
import { useJobCounts } from '../hooks/useJobs';
import { useReviewCount } from '../hooks/useReview';
import { useAssignmentCounts } from '../hooks/useAssignments';
import { hasFeature } from '../hooks/useFeatures';
import { ProBadge } from './ProGate';

const NAV = [
	{ to: '/dashboard', label: () => __('Dashboard', 'gemtranslate'), icon: '◆' },
	{ to: '/languages', label: () => __('Languages', 'gemtranslate'), icon: '🌐' },
	{ to: '/posts', label: () => __('Posts & Pages', 'gemtranslate'), icon: '📝' },
	{
		to: '/review',
		label: () => __('Review', 'gemtranslate'),
		icon: '✅',
		badge: 'review',
		pro: 'translate_everything',
	},
	{ to: '/terms', label: () => __('Taxonomies', 'gemtranslate'), icon: '🏷' },
	{ to: '/strings', label: () => __('Strings', 'gemtranslate'), icon: '🔤' },
	{ to: '/menus', label: () => __('Menus', 'gemtranslate'), icon: '☰' },
	{ to: '/seo', label: () => __('SEO', 'gemtranslate'), icon: '🔍', pro: 'seo_advanced' },
	{ to: '/ai', label: () => __('AI Translation', 'gemtranslate'), icon: '✨' },
	{ to: '/glossary', label: () => __('Glossary', 'gemtranslate'), icon: '📖', pro: 'glossary' },
	{
		to: '/jobs',
		label: () => __('Jobs', 'gemtranslate'),
		icon: '⏱',
		badge: 'jobs',
		pro: 'ai_bulk',
	},
	{
		to: '/assignments',
		label: () => __('Assignments', 'gemtranslate'),
		icon: '📋',
		pro: 'translators',
		badge: 'assignments',
	},
	{
		to: '/translators',
		label: () => __('Translators', 'gemtranslate'),
		icon: '👥',
		pro: 'translators',
	},
	{ to: '/migration', label: () => __('Migration', 'gemtranslate'), icon: '⇆' },
	{
		to: '/io',
		label: () => __('Import & Export', 'gemtranslate'),
		icon: '⇪',
		pro: 'import_export',
	},
	{ to: '/settings', label: () => __('Settings', 'gemtranslate'), icon: '⚙' },
];

export default function Sidebar() {
	const counts = useJobCounts();
	const liveJobs = (counts.data?.pending ?? 0) + (counts.data?.running ?? 0);
	const reviewCount = useReviewCount();
	const pendingReview = reviewCount.data ?? 0;
	const assignmentCounts = useAssignmentCounts();
	const openAssignments = assignmentCounts.data?.open ?? 0;

	return (
		<aside className="gtrans-w-60 gtrans-flex-shrink-0 gtrans-border-r gtrans-border-edge gtrans-bg-surface gtrans-px-4 gtrans-py-6">
			<div className="gtrans-mb-6 gtrans-px-2">
				<div className="gtrans-text-lg gtrans-font-semibold gtrans-text-primary">
					GemTranslate
				</div>
				<div className="gtrans-text-xs gtrans-text-muted">
					v{window.gtrans?.version || '1.0.0'}
				</div>
			</div>

			<LanguagePicker />

			<nav className="gtrans-mt-6 gtrans-flex gtrans-flex-col gtrans-gap-1">
				{NAV.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							clsx(
								'gtrans-flex gtrans-items-center gtrans-gap-3 gtrans-rounded gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-no-underline gtrans-transition-colors',
								isActive
									? 'gtrans-bg-navactive gtrans-text-primary gtrans-font-medium'
									: 'gtrans-text-label hover:gtrans-bg-body'
							)
						}
					>
						<span className="gtrans-text-base" aria-hidden="true">
							{item.icon}
						</span>
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
					</NavLink>
				))}
			</nav>
		</aside>
	);
}

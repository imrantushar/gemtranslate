import { __ } from '@wordpress/i18n';
import { hasFeature } from '../hooks/useFeatures';
import PageHeader from './PageHeader';
import Card from './Card';

/**
 * Small inline "PRO" pill for sidebar items / tabs.
 */
export function ProBadge() {
	return (
		<span className="ztrans-ml-auto ztrans-rounded ztrans-bg-amber-100 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-[10px] ztrans-font-semibold ztrans-uppercase ztrans-text-amber-700">
			{__('Pro', 'zentranslate')}
		</span>
	);
}

/**
 * Upsell panel shown in place of a Pro surface when the feature is locked.
 */
export function UpsellCard({ title, description }) {
	return (
		<Card>
			<div className="ztrans-flex ztrans-flex-col ztrans-items-start ztrans-gap-3 ztrans-py-4">
				<span className="ztrans-rounded-full ztrans-bg-amber-100 ztrans-px-3 ztrans-py-1 ztrans-text-xs ztrans-font-semibold ztrans-uppercase ztrans-text-amber-700">
					{__('Zentranslate Pro', 'zentranslate')}
				</span>
				<h3 className="ztrans-m-0 ztrans-text-lg ztrans-font-semibold ztrans-text-gray-900">
					{title || __('This is a Pro feature', 'zentranslate')}
				</h3>
				{description && (
					<p className="ztrans-m-0 ztrans-max-w-lg ztrans-text-sm ztrans-text-ztrans-muted">
						{description}
					</p>
				)}
				<a
					href="https://zentranslate.com/pro"
					target="_blank"
					rel="noopener noreferrer"
					className="ztrans-mt-1 ztrans-inline-flex ztrans-items-center ztrans-gap-2 ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-4 ztrans-py-2 ztrans-text-sm ztrans-font-medium ztrans-text-white ztrans-no-underline hover:ztrans-bg-ztrans-primary-hover"
				>
					{__('Upgrade to Pro →', 'zentranslate')}
				</a>
			</div>
		</Card>
	);
}

/**
 * Gate a whole page/section on a Pro feature flag. Renders `children` when the
 * feature is available, else a full upsell page (with optional header).
 */
export default function ProGate({ feature, title, description, header, children }) {
	if (hasFeature(feature)) {
		return children;
	}
	return (
		<>
			{header && <PageHeader title={header} />}
			<UpsellCard title={title} description={description} />
		</>
	);
}

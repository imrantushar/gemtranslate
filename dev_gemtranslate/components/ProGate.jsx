import { __ } from '@wordpress/i18n';
import { hasFeature } from '../hooks/useFeatures';
import PageHeader from './PageHeader';
import Card from './Card';

/**
 * Small inline "PRO" pill for sidebar items / tabs.
 */
export function ProBadge() {
	return (
		<span className="gtrans-ml-auto gtrans-rounded gtrans-bg-amber-100 gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[10px] gtrans-font-semibold gtrans-uppercase gtrans-text-amber-700">
			{__('Pro', 'gemtranslate')}
		</span>
	);
}

/**
 * Upsell panel shown in place of a Pro surface when the feature is locked.
 */
export function UpsellCard({ title, description }) {
	return (
		<Card>
			<div className="gtrans-flex gtrans-flex-col gtrans-items-start gtrans-gap-3 gtrans-py-4">
				<span className="gtrans-rounded-full gtrans-bg-amber-100 gtrans-px-3 gtrans-py-1 gtrans-text-xs gtrans-font-semibold gtrans-uppercase gtrans-text-amber-700">
					{__('GemTranslate Pro', 'gemtranslate')}
				</span>
				<h3 className="gtrans-m-0 gtrans-text-lg gtrans-font-semibold gtrans-text-ink">
					{title || __('This is a Pro feature', 'gemtranslate')}
				</h3>
				{description && (
					<p className="gtrans-m-0 gtrans-max-w-lg gtrans-text-sm gtrans-text-muted">
						{description}
					</p>
				)}
				<a
					href="https://gemtranslate.com/pro"
					target="_blank"
					rel="noopener noreferrer"
					className="gtrans-mt-1 gtrans-inline-flex gtrans-items-center gtrans-gap-2 gtrans-rounded-md gtrans-bg-primary gtrans-px-4 gtrans-py-2 gtrans-text-sm gtrans-font-medium gtrans-text-white gtrans-no-underline hover:gtrans-bg-primary-hover"
				>
					{__('Upgrade to Pro →', 'gemtranslate')}
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

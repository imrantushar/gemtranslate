import { useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { hasFeature } from '../hooks/useFeatures';
import { getProFeature, UPGRADE_URL } from '../lib/proFeatures';
import Icon from './Icon';
import Card from './Card';

const ORANGE = 'gtrans-bg-[#F97316] hover:gtrans-bg-[#ea6a0c]';

/** Orange "Upgrade to Pro" button — GemCRM's promo CTA. */
export function UpgradeButton({ children, className = '' }) {
	return (
		<a
			href={UPGRADE_URL}
			target="_blank"
			rel="noopener noreferrer"
			className={`gtrans-inline-flex gtrans-w-fit gtrans-items-center gtrans-gap-2 gtrans-rounded gtrans-px-4 gtrans-py-2.5 gtrans-text-sm gtrans-font-medium gtrans-text-white gtrans-no-underline visited:gtrans-text-white hover:gtrans-text-white ${ORANGE} ${className}`}
		>
			<Icon name="crown" size={14} />
			{children || __('Upgrade to Pro', 'gemtranslate')}
		</a>
	);
}

/** Small orange "PRO" pill with a crown, for sidebar items and tabs. */
export function ProBadge() {
	return (
		<span className="gtrans-ml-auto gtrans-inline-flex gtrans-items-center gtrans-gap-1 gtrans-rounded gtrans-bg-[#F97316] gtrans-px-1.5 gtrans-py-0.5 gtrans-text-[10px] gtrans-font-semibold gtrans-uppercase gtrans-leading-none gtrans-text-white">
			<Icon name="crown" size={10} />
			{__('Pro', 'gemtranslate')}
		</span>
	);
}

/**
 * Hover tooltip for a locked control: feature name, Pro badge, blurb and an
 * "Upgrade Now" button (GemCRM's ProUpgradeTooltip).
 */
export function ProUpgradeTooltip({ name, description, children }) {
	const [show, setShow] = useState(false);
	const timer = useRef(null);
	const open = () => {
		clearTimeout(timer.current);
		setShow(true);
	};
	const close = () => {
		timer.current = setTimeout(() => setShow(false), 120);
	};

	return (
		<span className="gtrans-relative gtrans-inline-flex" onMouseEnter={open} onMouseLeave={close}>
			{children}
			{show && (
				<span
					className="gtrans-absolute gtrans-bottom-7 gtrans-right-0 gtrans-flex gtrans-w-[220px] gtrans-flex-col gtrans-items-center gtrans-gap-3 gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-4"
					style={{ zIndex: 10000, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
					onMouseEnter={open}
					onMouseLeave={close}
				>
					<span className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-center gtrans-gap-2">
						<strong className="gtrans-text-center gtrans-text-base gtrans-text-ink">{name}</strong>
						<ProBadge />
					</span>
					<span className="gtrans-text-center gtrans-text-sm gtrans-text-muted">
						{description || __('Upgrade to unlock this feature!', 'gemtranslate')}
					</span>
					<a
						href={UPGRADE_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="gtrans-flex gtrans-h-9 gtrans-w-full gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-bg-primary gtrans-text-sm gtrans-font-medium gtrans-text-white gtrans-no-underline visited:gtrans-text-white hover:gtrans-text-white hover:gtrans-opacity-90"
					>
						{__('Upgrade Now', 'gemtranslate')}
					</a>
				</span>
			)}
		</span>
	);
}

/**
 * Compact promo card for a Pro section inside a page (e.g. Settings, AI).
 */
export function UpsellCard({ title, description }) {
	return (
		<Card>
			<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-4">
				<div className="gtrans-flex gtrans-items-start gtrans-gap-4">
					<span className="gtrans-flex gtrans-h-10 gtrans-w-10 gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-bg-primary-light gtrans-text-primary">
						<Icon name="crown" size={18} />
					</span>
					<div>
						<div className="gtrans-flex gtrans-items-center gtrans-gap-2">
							<h3 className="gtrans-m-0 gtrans-text-base gtrans-font-semibold gtrans-text-ink">
								{title || __('This is a Pro feature', 'gemtranslate')}
							</h3>
							<ProBadge />
						</div>
						{description && (
							<p className="gtrans-m-0 gtrans-mt-1 gtrans-max-w-xl gtrans-text-sm gtrans-text-muted">{description}</p>
						)}
					</div>
				</div>
				<UpgradeButton />
			</div>
		</Card>
	);
}

/**
 * Full-page promo (GemCRM "Unlock X with Pro"): headline + upgrade button,
 * a grid of benefit cards, and a closing call to action.
 */
export function ProPromo({ feature, header, title, description }) {
	const info = getProFeature(feature) || {};
	const name = header || title || info.title;
	const body = description || info.description;
	const items = info.items || [];

	return (
		<div className="gtrans-mx-auto gtrans-max-w-[1200px]">
			<div className="gtrans-mb-8 gtrans-flex gtrans-flex-wrap gtrans-items-start gtrans-justify-between gtrans-gap-8">
				<div className="gtrans-max-w-[760px]">
					<h1 className="gtrans-m-0 gtrans-mb-1 gtrans-text-xl gtrans-font-semibold gtrans-text-ink">
						{sprintf(
							/* translators: %s: feature name. */
							__('Unlock %s with GemTranslate Pro', 'gemtranslate'),
							name
						)}
					</h1>
					{body && <p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{body}</p>}
				</div>
				<UpgradeButton />
			</div>

			{items.length > 0 && (
				<div className="gtrans-mb-8 gtrans-grid gtrans-grid-cols-1 gtrans-gap-6 md:gtrans-grid-cols-2 xl:gtrans-grid-cols-3">
					{items.map((item) => (
						<div
							key={item.title}
							className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-6 gtrans-transition-all gtrans-duration-200 hover:gtrans-border-primary"
						>
							<span className="gtrans-mb-4 gtrans-flex gtrans-h-10 gtrans-w-10 gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-bg-primary-light gtrans-text-primary">
								<Icon name={item.icon} size={20} />
							</span>
							<h3 className="gtrans-m-0 gtrans-mb-2 gtrans-text-base gtrans-font-semibold gtrans-text-ink">{item.title}</h3>
							<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{item.desc}</p>
						</div>
					))}
				</div>
			)}

			<div className="gtrans-flex gtrans-flex-col gtrans-items-center gtrans-justify-center gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-px-8 gtrans-py-14 gtrans-text-center">
				<span className="gtrans-flex gtrans-h-14 gtrans-w-14 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-bg-primary-light gtrans-text-primary">
					<Icon name="crown" size={26} />
				</span>
				<h2 className="gtrans-m-0 gtrans-my-3.5 gtrans-text-3xl gtrans-font-bold gtrans-text-ink">
					{__('Ready to go further?', 'gemtranslate')}
				</h2>
				<p className="gtrans-m-0 gtrans-mx-auto gtrans-mb-8 gtrans-max-w-[520px] gtrans-text-base gtrans-text-muted">
					{__('Upgrade to GemTranslate Pro to unlock this and every other Pro feature.', 'gemtranslate')}
				</p>
				<UpgradeButton />
			</div>
		</div>
	);
}

/**
 * Gate a whole page on a Pro feature flag. Renders `children` when the
 * feature is available, else the full-page promo.
 */
export default function ProGate({ feature, title, description, header, children }) {
	if (hasFeature(feature)) {
		return children;
	}
	return <ProPromo feature={feature} header={header} title={title} description={description} />;
}

import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import Button from '../../components/Button';

/**
 * Translator-mode picker. Two cards side by side:
 *   • Strings only  — translate text, layout follows source
 *   • Custom layout — design a separate page in any editor
 *
 * The active card is highlighted; the inactive card shows a CTA to switch.
 * For string_only mode we just need a confirm; for custom_layout we create
 * a shadow WP post (handled by the parent's onPromote callback).
 */
export default function ModeSwitcher({
	mode,
	language,
	country,
	variantRow,
	onPromote,
	onDemote,
	isPromoting,
	isDemoting,
}) {
	const variantLabel = country ? `${language} · ${country}` : language;

	return (
		<div className="ztrans-mb-4 ztrans-grid ztrans-grid-cols-1 md:ztrans-grid-cols-2 ztrans-gap-3">
			<ModeCard
				active={mode === 'string_only'}
				icon="📝"
				title={__('Strings only', 'zentranslate')}
				summary={__('Translate text. Block layout, wrappers, and inline tags follow the source automatically.', 'zentranslate')}
				details={__('Best for most pages — when source design changes, translations stay bound.', 'zentranslate')}
				switchButton={
					mode === 'custom_layout' ? (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							loading={isDemoting}
							onClick={() => {
								// eslint-disable-next-line no-alert
								if (!window.confirm(__('Discard the custom layout and revert to string-only translations? Stored strings are preserved.', 'zentranslate'))) return;
								onDemote();
							}}
						>
							{__('↩ Revert to strings', 'zentranslate')}
						</Button>
					) : null
				}
			/>
			<ModeCard
				active={mode === 'custom_layout'}
				icon="🎨"
				title={__('Custom layout', 'zentranslate')}
				summary={__('Design a fully separate page in your editor. Works with Gutenberg, Elementor, Beaver, Divi, Bricks.', 'zentranslate')}
				details={
					mode === 'custom_layout' && variantRow?.shadow_post_id
						? sprintf(
								/* translators: 1: shadow post id, 2: variant label e.g. "es · MX". */
								__('Shadow post #%1$s · %2$s', 'zentranslate'),
								variantRow.shadow_post_id,
								variantLabel
						  )
						: __('Best for country-specific landing pages and homepages with different imagery.', 'zentranslate')
				}
				switchButton={
					mode === 'custom_layout' ? (
						variantRow?.shadow_edit_url ? (
							<a
								href={variantRow.shadow_edit_url}
								target="_blank"
								rel="noopener noreferrer"
								className="ztrans-inline-flex ztrans-items-center ztrans-gap-1 ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-3 ztrans-py-1.5 ztrans-text-xs ztrans-font-medium ztrans-text-white ztrans-no-underline hover:ztrans-bg-ztrans-primary-hover"
							>
								{__('Open in editor →', 'zentranslate')}
							</a>
						) : null
					) : (
						<Button
							type="button"
							variant="primary"
							size="sm"
							loading={isPromoting}
							onClick={() => {
								// eslint-disable-next-line no-alert
								if (!window.confirm(sprintf(
									/* translators: %s: variant label e.g. "Spanish · MX". */
									__('Create a custom-layout copy of this page for %s? It opens in your normal WordPress editor.', 'zentranslate'),
									variantLabel
								))) return;
								onPromote();
							}}
						>
							{__('Switch to custom layout →', 'zentranslate')}
						</Button>
					)
				}
			/>
		</div>
	);
}

function ModeCard({ active, icon, title, summary, details, switchButton }) {
	return (
		<div
			className={clsx(
				'ztrans-rounded-lg ztrans-border ztrans-p-4 ztrans-transition-colors',
				active
					? 'ztrans-border-ztrans-primary ztrans-bg-ztrans-primary/5 ztrans-shadow-sm'
					: 'ztrans-border-ztrans-border ztrans-bg-white'
			)}
		>
			<div className="ztrans-flex ztrans-items-start ztrans-justify-between ztrans-gap-2">
				<div className="ztrans-flex ztrans-items-center ztrans-gap-2">
					<span className="ztrans-text-lg" aria-hidden="true">{icon}</span>
					<h3 className="ztrans-m-0 ztrans-text-sm ztrans-font-semibold ztrans-text-gray-900">
						{title}
					</h3>
				</div>
				{active && (
					<span className="ztrans-rounded-full ztrans-bg-emerald-100 ztrans-px-2 ztrans-py-0.5 ztrans-text-[10px] ztrans-font-semibold ztrans-uppercase ztrans-tracking-wide ztrans-text-emerald-800">
						{__('Active', 'zentranslate')}
					</span>
				)}
			</div>
			<p className="ztrans-mt-2 ztrans-mb-1 ztrans-text-xs ztrans-leading-relaxed ztrans-text-gray-700">
				{summary}
			</p>
			<p className="ztrans-mb-3 ztrans-text-xs ztrans-text-ztrans-muted">
				{details}
			</p>
			{switchButton && (
				<div className="ztrans-mt-3 ztrans-flex ztrans-justify-end">
					{switchButton}
				</div>
			)}
		</div>
	);
}

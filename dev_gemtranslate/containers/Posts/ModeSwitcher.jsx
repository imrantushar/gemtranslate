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
		<div className="gtrans-mb-4 gtrans-grid gtrans-grid-cols-1 md:gtrans-grid-cols-2 gtrans-gap-3">
			<ModeCard
				active={mode === 'string_only'}
				icon="📝"
				title={__('Strings only', 'gemtranslate')}
				summary={__('Translate text. Block layout, wrappers, and inline tags follow the source automatically.', 'gemtranslate')}
				details={__('Best for most pages — when source design changes, translations stay bound.', 'gemtranslate')}
				switchButton={
					mode === 'custom_layout' ? (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							loading={isDemoting}
							onClick={() => {
								// eslint-disable-next-line no-alert
								if (!window.confirm(__('Discard the custom layout and revert to string-only translations? Stored strings are preserved.', 'gemtranslate'))) return;
								onDemote();
							}}
						>
							{__('↩ Revert to strings', 'gemtranslate')}
						</Button>
					) : null
				}
			/>
			<ModeCard
				active={mode === 'custom_layout'}
				icon="🎨"
				title={__('Custom layout', 'gemtranslate')}
				summary={__('Design a fully separate page in your editor. Works with Gutenberg, Elementor, Beaver, Divi, Bricks.', 'gemtranslate')}
				details={
					mode === 'custom_layout' && variantRow?.shadow_post_id
						? sprintf(
								/* translators: 1: shadow post id, 2: variant label e.g. "es · MX". */
								__('Shadow post #%1$s · %2$s', 'gemtranslate'),
								variantRow.shadow_post_id,
								variantLabel
						  )
						: __('Best for country-specific landing pages and homepages with different imagery.', 'gemtranslate')
				}
				switchButton={
					mode === 'custom_layout' ? (
						variantRow?.shadow_edit_url ? (
							<a
								href={variantRow.shadow_edit_url}
								target="_blank"
								rel="noopener noreferrer"
								className="gtrans-inline-flex gtrans-items-center gtrans-gap-1 gtrans-rounded-md gtrans-bg-gtrans-primary gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-font-medium gtrans-text-white gtrans-no-underline hover:gtrans-bg-gtrans-primary-hover"
							>
								{__('Open in editor →', 'gemtranslate')}
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
									__('Create a custom-layout copy of this page for %s? It opens in your normal WordPress editor.', 'gemtranslate'),
									variantLabel
								))) return;
								onPromote();
							}}
						>
							{__('Switch to custom layout →', 'gemtranslate')}
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
				'gtrans-rounded-lg gtrans-border gtrans-p-4 gtrans-transition-colors',
				active
					? 'gtrans-border-gtrans-primary gtrans-bg-gtrans-primary/5 gtrans-shadow-sm'
					: 'gtrans-border-gtrans-border gtrans-bg-white'
			)}
		>
			<div className="gtrans-flex gtrans-items-start gtrans-justify-between gtrans-gap-2">
				<div className="gtrans-flex gtrans-items-center gtrans-gap-2">
					<span className="gtrans-text-lg" aria-hidden="true">{icon}</span>
					<h3 className="gtrans-m-0 gtrans-text-sm gtrans-font-semibold gtrans-text-gray-900">
						{title}
					</h3>
				</div>
				{active && (
					<span className="gtrans-rounded-full gtrans-bg-emerald-100 gtrans-px-2 gtrans-py-0.5 gtrans-text-[10px] gtrans-font-semibold gtrans-uppercase gtrans-tracking-wide gtrans-text-emerald-800">
						{__('Active', 'gemtranslate')}
					</span>
				)}
			</div>
			<p className="gtrans-mt-2 gtrans-mb-1 gtrans-text-xs gtrans-leading-relaxed gtrans-text-gray-700">
				{summary}
			</p>
			<p className="gtrans-mb-3 gtrans-text-xs gtrans-text-gtrans-muted">
				{details}
			</p>
			{switchButton && (
				<div className="gtrans-mt-3 gtrans-flex gtrans-justify-end">
					{switchButton}
				</div>
			)}
		</div>
	);
}

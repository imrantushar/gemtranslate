import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

/**
 * Compact layout-mode control: a two-option segmented switch.
 *   • Strings only  — translate text, layout follows the source
 *   • Custom layout — design a separate page in any editor
 *
 * The inactive option asks for confirmation before switching (custom layout
 * creates a shadow WP post, handled by the parent's onPromote callback). Context
 * for the active mode sits in the tooltips and a short hint beside the switch.
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
	const busy = isPromoting || isDemoting;

	const pick = (next) => {
		if (next === mode || busy) return;
		if (next === 'custom_layout') {
			// eslint-disable-next-line no-alert
			if (!window.confirm(sprintf(
				/* translators: %s: variant label e.g. "Spanish · MX". */
				__('Create a custom-layout copy of this page for %s? It opens in your normal WordPress editor.', 'gemtranslate'),
				variantLabel
			))) return;
			onPromote();
		} else {
			// eslint-disable-next-line no-alert
			if (!window.confirm(__('Discard the custom layout and revert to string-only translations? Stored strings are preserved.', 'gemtranslate'))) return;
			onDemote();
		}
	};

	const options = [
		{
			value: 'string_only',
			label: __('Strings only', 'gemtranslate'),
			hint: __('Translate text. Block layout, wrappers and inline tags follow the source automatically — best for most pages.', 'gemtranslate'),
		},
		{
			value: 'custom_layout',
			label: __('Custom layout', 'gemtranslate'),
			hint: __('Design a fully separate page in your editor (Gutenberg, Elementor, Beaver, Divi, Bricks) — best for country-specific landing pages.', 'gemtranslate'),
		},
	];

	return (
		<div className="gtrans-ml-auto gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
			<div className="gtrans-inline-flex" role="group" aria-label={__('Layout mode', 'gemtranslate')}>
				{options.map((o, i) => {
					const active = mode === o.value;
					return (
						<button
							key={o.value}
							type="button"
							title={o.hint}
							aria-pressed={active}
							disabled={busy}
							onClick={() => pick(o.value)}
							className={clsx(
								'gtrans-bare gtrans-cursor-pointer gtrans-border gtrans-px-3 gtrans-py-1.5 gtrans-text-sm',
								i === 0 ? 'gtrans-rounded-l-md' : '-gtrans-ml-px gtrans-rounded-r-md',
								active
									? 'gtrans-border-primary gtrans-bg-primary gtrans-text-white'
									: 'gtrans-border-line gtrans-bg-surface gtrans-text-label hover:gtrans-bg-body',
								busy && 'gtrans-cursor-wait gtrans-opacity-70'
							)}
						>
							{o.label}
						</button>
					);
				})}
			</div>
			{mode === 'custom_layout' && variantRow?.shadow_edit_url && (
				<a
					href={variantRow.shadow_edit_url}
					target="_blank"
					rel="noopener noreferrer"
					className="gtrans-text-sm gtrans-text-primary gtrans-no-underline hover:gtrans-underline"
				>
					{__('Open in editor →', 'gemtranslate')}
				</a>
			)}
		</div>
	);
}

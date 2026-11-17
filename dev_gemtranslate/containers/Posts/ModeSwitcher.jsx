import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Modal from '../../components/Modal';

/** Starting points offered when a page is switched to a custom layout. */
const START_OPTIONS = [
	{
		value: 'translated',
		label: __('Source with my translations', 'gemtranslate'),
		hint: __('Copy the source page and apply the strings already translated for this language.', 'gemtranslate'),
	},
	{
		value: 'source',
		label: __('Copy of the source page', 'gemtranslate'),
		hint: __('An exact copy of the main-language page, untranslated.', 'gemtranslate'),
	},
	{
		value: 'blank',
		label: __('Blank page', 'gemtranslate'),
		hint: __('Start with empty content and build the page from scratch. The title is kept.', 'gemtranslate'),
	},
];

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
	startOptions = START_OPTIONS,
	customHint,
	chooserText,
	demoteConfirm,
}) {
	const variantLabel = country ? `${language} · ${country}` : language;
	const busy = isPromoting || isDemoting;
	const [chooserOpen, setChooserOpen] = useState(false);
	const [startFrom, setStartFrom] = useState(startOptions[0].value);

	const pick = (next) => {
		if (next === mode || busy) return;
		if (next === 'custom_layout') {
			setChooserOpen(true);
		} else {
			// eslint-disable-next-line no-alert
			if (!window.confirm(demoteConfirm || __('Discard the custom layout and revert to string-only translations? Stored strings are preserved.', 'gemtranslate'))) return;
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
			hint: customHint || __('Design a fully separate page in your editor (Gutenberg, Elementor, Beaver, Divi, Bricks) — best for country-specific landing pages.', 'gemtranslate'),
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
			<Modal
				open={chooserOpen}
				size="sm"
				title={__('Create custom layout', 'gemtranslate')}
				subtitle={variantLabel}
				onClose={() => setChooserOpen(false)}
				footer={(
					<>
						<button
							type="button"
							onClick={() => setChooserOpen(false)}
							className="gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-4 gtrans-py-2 gtrans-text-sm gtrans-text-label hover:gtrans-bg-body"
						>
							{__('Cancel', 'gemtranslate')}
						</button>
						<button
							type="button"
							onClick={() => {
								setChooserOpen(false);
								onPromote(startFrom);
							}}
							className="gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-primary gtrans-bg-primary gtrans-px-4 gtrans-py-2 gtrans-text-sm gtrans-text-white"
						>
							{__('Create and edit', 'gemtranslate')}
						</button>
					</>
				)}
			>
				<p className="gtrans-m-0 gtrans-mb-4 gtrans-text-sm gtrans-text-muted">
					{chooserText || __('Where should the new page start from? It opens in your normal WordPress editor.', 'gemtranslate')}
				</p>
				<div className="gtrans-flex gtrans-flex-col gtrans-gap-2" role="radiogroup">
					{startOptions.map((o) => (
						<label
							key={o.value}
							className={clsx(
								'gtrans-flex gtrans-cursor-pointer gtrans-items-start gtrans-gap-3 gtrans-rounded-md gtrans-border gtrans-p-3',
								startFrom === o.value ? 'gtrans-border-primary' : 'gtrans-border-line'
							)}
						>
							<input
								type="radio"
								name="gtrans-start-from"
								value={o.value}
								checked={startFrom === o.value}
								onChange={() => setStartFrom(o.value)}
								className="gtrans-mt-1"
								style={{ appearance: 'auto', accentColor: 'var(--gtrans-primary-color)' }}
							/>
							<span>
								<span className="gtrans-block gtrans-text-sm gtrans-font-medium gtrans-text-ink">{o.label}</span>
								<span className="gtrans-block gtrans-text-xs gtrans-text-muted">{o.hint}</span>
							</span>
						</label>
					))}
				</div>
			</Modal>
		</div>
	);
}

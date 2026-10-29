import { __ } from '@wordpress/i18n';

import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Logo from './Logo';

// Each capability renders as an icon feature-card; `icon` is a dashicon.
const CAPABILITIES = [
	{ icon: 'translation', tone: 'primary', label: () => __('Posts & pages', 'gemtranslate'), note: () => __('Side-by-side editor', 'gemtranslate') },
	{ icon: 'superhero-alt', tone: 'violet', label: () => __('AI translation', 'gemtranslate'), note: () => __('One click, your tone', 'gemtranslate') },
	{ icon: 'admin-site-alt3', tone: 'success', label: () => __('Language URLs', 'gemtranslate'), note: () => __('/fr/, /de/ and more', 'gemtranslate') },
	{ icon: 'menu', tone: 'warning', label: () => __('Menus & strings', 'gemtranslate'), note: () => __('Theme and plugin labels', 'gemtranslate') },
	{ icon: 'database', tone: 'primary', label: () => __('Translation memory', 'gemtranslate'), note: () => __('Never translate twice', 'gemtranslate') },
	{ icon: 'search', tone: 'success', label: () => __('SEO ready', 'gemtranslate'), note: () => __('Hreflang & translated meta', 'gemtranslate') },
];

// Full literal class strings per tone so Tailwind's JIT keeps them.
const TONE_CHIP = {
	primary: 'gtrans-bg-primary-light gtrans-text-primary',
	violet: 'gtrans-bg-[#7c5cff]/10 gtrans-text-[#7c5cff]',
	success: 'gtrans-bg-success-light gtrans-text-success',
	warning: 'gtrans-bg-warning-light gtrans-text-warning',
};

function CapabilityCard({ c }) {
	return (
		<div className="gtrans-flex gtrans-w-[230px] gtrans-shrink-0 gtrans-items-center gtrans-gap-3 gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-p-3.5 gtrans-text-left gtrans-transition-all gtrans-duration-300 hover:gtrans-border-primary">
			<span className={`gtrans-flex gtrans-h-9 gtrans-w-9 gtrans-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded-md ${TONE_CHIP[c.tone]}`}>
				<span className={`dashicons dashicons-${c.icon}`} style={{ width: 18, height: 18, fontSize: 18 }} aria-hidden="true" />
			</span>
			<span className="gtrans-min-w-0">
				<span className="gtrans-block gtrans-text-[13.5px] gtrans-font-semibold gtrans-text-ink">{c.label()}</span>
				<span className="gtrans-block gtrans-text-xs gtrans-text-description">{c.note()}</span>
			</span>
		</div>
	);
}

// The list renders twice back-to-back so the CSS animation loops 0 → -50% seamlessly.
function MarqueeRow({ reverse }) {
	return (
		<div className={`gtrans-marquee-row${reverse ? ' gtrans-marquee-row--reverse' : ''}`}>
			<div className="gtrans-marquee-track">
				{[...CAPABILITIES, ...CAPABILITIES].map((c, i) => (
					<CapabilityCard key={i} c={c} />
				))}
			</div>
		</div>
	);
}

export default function Welcome({ onStart, onSkip, skipping }) {
	return (
		<div className="gtrans-relative gtrans-flex gtrans-min-h-full gtrans-flex-col gtrans-items-center gtrans-justify-center gtrans-overflow-hidden gtrans-px-6 gtrans-py-16 gtrans-text-center">
			{/* Soft ambient backdrop — a primary glow up top fading into the page. */}
			<div
				aria-hidden="true"
				className="gtrans-pointer-events-none gtrans-absolute gtrans-inset-x-0 gtrans-top-0 gtrans-h-[420px]"
				style={{ background: 'radial-gradient(680px 320px at 50% -40px, color-mix(in srgb, var(--gtrans-primary-color) 14%, transparent), transparent 70%)' }}
			/>

			<div className="gtrans-relative gtrans-z-[1] gtrans-w-full gtrans-max-w-[1200px]">
				<Logo className="gtrans-mb-9 gtrans-justify-center" />

				<h1 className="gtrans-m-0 gtrans-mt-6 gtrans-text-[32px] gtrans-font-bold gtrans-leading-[1.1] gtrans-tracking-tight gtrans-text-heading">
					{__('Reach every reader.', 'gemtranslate')}{' '}
					<span className="gtrans-text-primary">{__('In their language.', 'gemtranslate')}</span>
				</h1>
				<p className="gtrans-mx-auto gtrans-mb-0 gtrans-mt-5 gtrans-max-w-[760px] gtrans-text-base gtrans-leading-relaxed gtrans-text-description">
					{__('GemTranslate makes your WordPress site multilingual without slowing it down — translate posts, menus and strings by hand or with AI. Let’s set up your languages.', 'gemtranslate')}
				</p>

				{/* Decorative, auto-scrolling — hidden from the accessibility tree. */}
				<div className="gtrans-mx-auto gtrans-mt-10 gtrans-flex gtrans-max-w-[1200px] gtrans-flex-col gtrans-gap-3" aria-hidden="true">
					<MarqueeRow />
					<MarqueeRow reverse />
				</div>

				<div className="gtrans-mt-11 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-center gtrans-gap-3">
					<Button size="lg" onClick={onStart}>
						{__('Start setup', 'gemtranslate')}
						<Icon name="chevron" size={16} />
					</Button>
					<Button size="lg" variant="ghost" onClick={onSkip} loading={skipping}>
						{__('I’ll explore on my own', 'gemtranslate')}
					</Button>
				</div>
			</div>
		</div>
	);
}

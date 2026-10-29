import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import Icon from '../../components/Icon';
import TopbarActions from '../../components/TopbarActions';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, TextInput } from '../../components/Input';
import { Select } from '../../components/ui/Select';
import { SettingRow } from '../../components/Switch';
import { PageSkeleton } from '../../components/Skeleton';
import { useSettings, useSaveSettings } from '../../hooks/useSettings';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

// ---------------------------------------------------------------------------
// Inline flag-emoji helper (mirrors the PHP version).
// ---------------------------------------------------------------------------
function flagEmoji(code) {
	const lower = (code || '').toLowerCase();
	const langToRegion = {
		en: 'GB',
		es: 'ES',
		fr: 'FR',
		de: 'DE',
		it: 'IT',
		pt: 'PT',
		ru: 'RU',
		ja: 'JP',
		zh: 'CN',
		ar: 'SA',
		he: 'IL',
		hi: 'IN',
		bn: 'BD',
		ko: 'KR',
		tr: 'TR',
		nl: 'NL',
		pl: 'PL',
	};
	let region;
	if (lower.includes('-')) {
		region = lower.split('-').pop().toUpperCase();
	} else {
		region = (langToRegion[lower] || lower.toUpperCase()).toUpperCase();
	}
	if (region.length !== 2) return lower.toUpperCase();
	return (
		String.fromCodePoint(0x1f1e6 + region.charCodeAt(0) - 65) +
		String.fromCodePoint(0x1f1e6 + region.charCodeAt(1) - 65)
	);
}

// ---------------------------------------------------------------------------
// Live switcher preview — no server round-trip needed.
// ---------------------------------------------------------------------------
function SwitcherPreview({ values, languages }) {
	const langs = (languages || []).filter((l) => l.active);
	if (langs.length === 0) {
		return (
			<p className="gtrans-text-xs gtrans-text-muted gtrans-italic">
				{__('Add at least one active language to see the preview.', 'gemtranslate')}
			</p>
		);
	}

	const items = langs
		.filter((l) => !(values.switcher_hide_current && l.is_default))
		.map((l) => {
			const parts = [];
			if (values.switcher_show_flag) parts.push(flagEmoji(l.flag || l.code));
			if (values.switcher_show_name) parts.push(l.name);
			if (values.switcher_show_native && !values.switcher_show_name) parts.push(l.native_name);
			else if (values.switcher_show_native) parts.push(`(${l.native_name})`);
			if (values.switcher_show_code) parts.push(`(${l.code})`);
			return { label: parts.join(' ') || l.code, isDefault: l.is_default };
		});

	if (values.switcher_display === 'dropdown') {
		return (
			<div className="gtrans-inline-block gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-text-sm">
				<div className="gtrans-flex gtrans-cursor-pointer gtrans-items-center gtrans-gap-1 gtrans-px-3 gtrans-py-2 gtrans-font-medium">
					{items.find((i) => i.isDefault)?.label || items[0]?.label}
					<span className="gtrans-text-xs gtrans-text-muted">▾</span>
				</div>
				<ul className="gtrans-m-0 gtrans-list-none gtrans-border-t gtrans-border-line gtrans-p-0">
					{items.map((item, i) => (
						<li
							key={i}
							className={`gtrans-px-3 gtrans-py-1.5 gtrans-text-sm ${
								item.isDefault ? 'gtrans-font-semibold' : 'gtrans-text-label'
							}`}
						>
							{item.label}
						</li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<ul className="gtrans-m-0 gtrans-flex gtrans-list-none gtrans-flex-wrap gtrans-gap-3 gtrans-p-0">
			{items.map((item, i) => (
				<li
					key={i}
					className={`gtrans-text-sm ${
						item.isDefault
							? 'gtrans-font-semibold gtrans-text-primary'
							: 'gtrans-text-label'
					}`}
				>
					{item.label}
				</li>
			))}
		</ul>
	);
}


/** Sidebar entries: one per settings screen. */
const TABS = () => [
	{
		key: 'general',
		icon: 'settings',
		label: __('General', 'gemtranslate'),
		hint: __('Basic plugin settings', 'gemtranslate'),
		description: __('General preferences for how GemTranslate behaves.', 'gemtranslate'),
	},
	{
		key: 'switcher',
		icon: 'globe',
		label: __('Language switcher', 'gemtranslate'),
		hint: __('Appearance and defaults', 'gemtranslate'),
		description: __('Defaults for the shortcode, widget and block, with a live preview.', 'gemtranslate'),
	},
	{
		key: 'floating',
		icon: 'panel',
		label: __('Floating switcher', 'gemtranslate'),
		hint: __('Button on every page', 'gemtranslate'),
		description: __('A fixed language button shown on every frontend page.', 'gemtranslate'),
	},
	{
		key: 'geo',
		icon: 'swap',
		label: __('Country detection', 'gemtranslate'),
		hint: __('Variants by location', 'gemtranslate'),
		description: __('Pick country variants and the default language by visitor location.', 'gemtranslate'),
	},
	{
		key: 'advanced',
		icon: 'database',
		label: __('Advanced', 'gemtranslate'),
		hint: __('Performance and data', 'gemtranslate'),
		description: __('Caching, diagnostics and what happens to your data on uninstall.', 'gemtranslate'),
	},
];

/** Left navigation: icon, label and a one-line hint per screen. */
function SettingsNav({ tabs, active, onSelect }) {
	return (
		<nav
			aria-label={__('Settings sections', 'gemtranslate')}
			className="gtrans-flex gtrans-gap-1 gtrans-overflow-x-auto lg:gtrans-flex-col"
		>
			{tabs.map((t) => {
				const on = t.key === active;
				return (
					<button
						key={t.key}
						type="button"
						onClick={() => onSelect(t.key)}
						aria-current={on ? 'page' : undefined}
						className={`gtrans-bare gtrans-flex gtrans-flex-shrink-0 lg:gtrans-w-full gtrans-cursor-pointer gtrans-items-center gtrans-gap-3 gtrans-rounded-lg gtrans-border-0 gtrans-px-3 gtrans-py-2.5 gtrans-text-left ${
							on ? 'gtrans-bg-navactive gtrans-text-primary' : 'gtrans-bg-transparent gtrans-text-description hover:gtrans-bg-body'
						}`}
					>
						<Icon name={t.icon} size={18} />
						<span className="gtrans-min-w-0">
							<span className={`gtrans-block gtrans-text-sm gtrans-font-semibold ${on ? '' : 'gtrans-text-ink'}`}>{t.label}</span>
							<span className="gtrans-block gtrans-text-xs">{t.hint}</span>
						</span>
					</button>
				);
			})}
		</nav>
	);
}

/** Right panel: heading, description, a rule, then rows separated by hairlines. */
function Panel({ title, description, children }) {
	return (
		<section className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-6 gtrans-shadow-gtrans">
			<h2 className="gtrans-m-0 gtrans-text-xl gtrans-font-semibold gtrans-text-heading">{title}</h2>
			<p className="gtrans-mb-0 gtrans-mt-1 gtrans-text-sm gtrans-text-description">{description}</p>
			<div className="gtrans-mt-5 gtrans-divide-y gtrans-divide-solid gtrans-divide-divider gtrans-border-0 gtrans-border-t gtrans-border-solid gtrans-border-divider">
				{children}
			</div>
		</section>
	);
}

/** A non-switch row (field, preview, code sample) with the same rhythm as the switch rows. */
function Block({ children }) {
	return <div className="gtrans-py-4">{children}</div>;
}

export default function SettingsPage() {
	const settings = useSettings();
	const languages = useLanguages();
	const save = useSaveSettings();
	const [params, setParams] = useSearchParams();
	const tabs = TABS();
	const tab = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'general';
	const current = tabs.find((t) => t.key === tab);
	const [values, setValues] = useState(null);
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (settings.data && !values) setValues(settings.data);
	}, [settings.data, values]);

	if (settings.isLoading || !values) return <PageSkeleton />;

	const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

	const submit = async () => {
		try {
			await save.mutateAsync(values);
			setToast({ tone: 'success', message: __('Settings saved.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<TopbarActions>
				<Button onClick={submit} loading={save.isPending}>
					{__('Save settings', 'gemtranslate')}
				</Button>
			</TopbarActions>

			<div className="gtrans-grid gtrans-items-start gtrans-gap-6 lg:gtrans-grid-cols-[280px_1fr]">
				<div className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-3 gtrans-shadow-gtrans">
					<SettingsNav tabs={tabs} active={tab} onSelect={(key) => setParams({ tab: key })} />
				</div>

				<Panel title={current.label} description={current.description}>
					{tab === 'general' && (
						<>
							<SettingRow
								label={__('Auto-redirect first visit by browser language', 'gemtranslate')}
								description={__(
									'Matches Accept-Language against active languages; 302s once and remembers the choice in a cookie.',
									'gemtranslate'
								)}
								checked={!!values.auto_redirect_browser_lang}
								onChange={(v) => set('auto_redirect_browser_lang', v)}
							/>
							<SettingRow
								label={__('Translate transactional emails per recipient', 'gemtranslate')}
								description={__(
									"Switches WP locale for the duration of each wp_mail() call to match the recipient's GemTranslate preferred language.",
									'gemtranslate'
								)}
								checked={!!values.translate_emails}
								onChange={(v) => set('translate_emails', v)}
							/>
							<SettingRow
								label={__('Show switcher for default language', 'gemtranslate')}
								checked={!!values.show_switcher_for_default}
								onChange={(v) => set('show_switcher_for_default', v)}
							/>
							<Block>
								<Field label={__('URL strategy', 'gemtranslate')}>
									<Select value={values.url_strategy} onChange={(e) => set('url_strategy', e.target.value)} disabled>
										<option value="subdirectory">{__('Subdirectory (/es/, /fr/)', 'gemtranslate')}</option>
									</Select>
								</Field>
								<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-xs gtrans-text-muted">
									{__(
										'Subdirectory URLs cache cleanly with page-cache plugins. Subdomain and per-domain modes are planned for v2.',
										'gemtranslate'
									)}
								</p>
							</Block>
						</>
					)}

					{tab === 'switcher' && (
						<>
							<Block>
								<Field label={__('Display style', 'gemtranslate')}>
									<Select
										value={values.switcher_display ?? 'inline'}
										onChange={(e) => set('switcher_display', e.target.value)}
									>
										<option value="inline">{__('Inline list', 'gemtranslate')}</option>
										<option value="dropdown">{__('Dropdown', 'gemtranslate')}</option>
									</Select>
								</Field>
							</Block>
							<SettingRow
								label={__('Show flag emoji', 'gemtranslate')}
								checked={values.switcher_show_flag !== false}
								onChange={(v) => set('switcher_show_flag', v)}
							/>
							<SettingRow
								label={__('Show language name (English)', 'gemtranslate')}
								checked={values.switcher_show_name !== false}
								onChange={(v) => set('switcher_show_name', v)}
							/>
							<SettingRow
								label={__('Show native name', 'gemtranslate')}
								checked={!!values.switcher_show_native}
								onChange={(v) => set('switcher_show_native', v)}
							/>
							<SettingRow
								label={__('Show language code (en, fr…)', 'gemtranslate')}
								checked={!!values.switcher_show_code}
								onChange={(v) => set('switcher_show_code', v)}
							/>
							<SettingRow
								label={__('Hide current language from the list', 'gemtranslate')}
								checked={!!values.switcher_hide_current}
								onChange={(v) => set('switcher_hide_current', v)}
							/>
							<SettingRow
								label={__('Show switcher even when only one language is active', 'gemtranslate')}
								description={__(
									'These are the defaults for the shortcode, widget, and block. Each instance can override them via its own settings.',
									'gemtranslate'
								)}
								checked={!!values.switcher_show_if_single}
								onChange={(v) => set('switcher_show_if_single', v)}
							/>
							<Block>
								<p className="gtrans-mb-2 gtrans-mt-0 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
									{__('Live preview', 'gemtranslate')}
								</p>
								<p className="gtrans-mb-3 gtrans-mt-0 gtrans-text-xs gtrans-text-muted">
									{__(
										'Shows how the switcher looks with the current settings. The bold item is the default language.',
										'gemtranslate'
									)}
								</p>
								<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-body gtrans-p-4">
									<SwitcherPreview values={values} languages={languages.data} />
								</div>
								<p className="gtrans-mb-1 gtrans-mt-5 gtrans-text-xs gtrans-font-semibold gtrans-text-label">
									{__('Shortcode', 'gemtranslate')}
								</p>
								<code className="gtrans-block gtrans-select-all gtrans-rounded gtrans-bg-body gtrans-px-3 gtrans-py-2 gtrans-text-xs gtrans-text-ink">
									{'[gemtranslate_language_switcher]'}
								</code>
								<p className="gtrans-mb-0 gtrans-mt-2 gtrans-text-xs gtrans-text-muted">
									{__(
										'Paste anywhere in a post, page, or text widget. Accepts display, show_flag, show_name, show_native, show_code, hide_current attributes to override the defaults above.',
										'gemtranslate'
									)}
								</p>
							</Block>
						</>
					)}

					{tab === 'floating' && (
						<>
							<SettingRow
								label={__('Show floating switcher on every page', 'gemtranslate')}
								description={__(
									'Injects a fixed-position language button on every frontend page — no shortcode or theme edits needed. Visible to all visitors including logged-out users.',
									'gemtranslate'
								)}
								checked={!!values.float_switcher_enabled}
								onChange={(v) => set('float_switcher_enabled', v)}
							/>
							{!!values.float_switcher_enabled && (
								<Block>
									<Field label={__('Position', 'gemtranslate')}>
										<Select
											value={values.float_switcher_position ?? 'bottom-right'}
											onChange={(e) => set('float_switcher_position', e.target.value)}
										>
											<option value="bottom-right">{__('Bottom right', 'gemtranslate')}</option>
											<option value="bottom-left">{__('Bottom left', 'gemtranslate')}</option>
											<option value="top-right">{__('Top right', 'gemtranslate')}</option>
											<option value="top-left">{__('Top left', 'gemtranslate')}</option>
										</Select>
									</Field>
								</Block>
							)}
						</>
					)}

					{tab === 'geo' && (
						<>
							<SettingRow
								label={__('Detect visitor country', 'gemtranslate')}
								description={__(
									"When enabled, the visitor's country is detected once per session and used to pick country-specific page variants and (optionally) the default language.",
									'gemtranslate'
								)}
								checked={!!values.geo_enabled}
								onChange={(v) => set('geo_enabled', v)}
							/>
							{!!values.geo_enabled && (
								<>
									<Block>
										<Field
											label={__('Detection source priority', 'gemtranslate')}
											hint={__(
												'First match wins. Comma-separated, in order. Options: cf_header, maxmind, cookie.',
												'gemtranslate'
											)}
										>
											<TextInput
												value={
													Array.isArray(values.geo_sources)
														? values.geo_sources.join(',')
														: String(values.geo_sources ?? '')
												}
												onChange={(e) =>
													set(
														'geo_sources',
														e.target.value
															.split(',')
															.map((s) => s.trim())
															.filter(Boolean)
													)
												}
											/>
										</Field>
									</Block>
									<Block>
										<Field
											label={__('MaxMind GeoLite2 DB path', 'gemtranslate')}
											hint={__(
												'Absolute path on the server to GeoLite2-Country.mmdb. Leave empty to skip MaxMind.',
												'gemtranslate'
											)}
										>
											<TextInput
												value={values.geo_maxmind_db_path || ''}
												onChange={(e) => set('geo_maxmind_db_path', e.target.value)}
											/>
										</Field>
									</Block>
									<SettingRow
										label={__("Auto-redirect first visit to country's default language", 'gemtranslate')}
										checked={!!values.geo_auto_redirect_country}
										onChange={(v) => set('geo_auto_redirect_country', v)}
									/>
									<SettingRow
										label={__('Show manual country picker banner when geo source has no match', 'gemtranslate')}
										checked={!!values.geo_country_picker_banner}
										onChange={(v) => set('geo_country_picker_banner', v)}
									/>
									<Block>
										<Field
											label={__('Country cookie TTL (days)', 'gemtranslate')}
											hint={__(
												"How long to remember the detected country in the visitor's browser.",
												'gemtranslate'
											)}
										>
											<TextInput
												type="number"
												value={values.geo_cookie_ttl_days ?? 90}
												onChange={(e) => set('geo_cookie_ttl_days', Number(e.target.value) || 0)}
											/>
										</Field>
									</Block>
								</>
							)}
						</>
					)}

					{tab === 'advanced' && (
						<>
							<SettingRow
								label={__('Use object cache (recommended)', 'gemtranslate')}
								checked={!!values.object_cache_enabled}
								onChange={(v) => set('object_cache_enabled', v)}
							/>
							<SettingRow
								label={__('Enable debug log', 'gemtranslate')}
								checked={!!values.debug_log_enabled}
								onChange={(v) => set('debug_log_enabled', v)}
							/>
							<SettingRow
								label={__('Delete all data on uninstall', 'gemtranslate')}
								description={__(
									'When enabled, removing the plugin from WP admin drops all wp_gtrans_* tables and clears GemTranslate options.',
									'gemtranslate'
								)}
								checked={!!values.remove_data_on_uninstall}
								onChange={(v) => set('remove_data_on_uninstall', v)}
							/>
						</>
					)}
				</Panel>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

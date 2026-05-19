import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Checkbox, Field, Select } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useSettings, useSaveSettings } from '../../hooks/useSettings';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

// ---------------------------------------------------------------------------
// Inline flag-emoji helper (mirrors the PHP version).
// ---------------------------------------------------------------------------
function flagEmoji(code) {
	const lower = (code || '').toLowerCase();
	const langToRegion = {
		en: 'GB', es: 'ES', fr: 'FR', de: 'DE', it: 'IT',
		pt: 'PT', ru: 'RU', ja: 'JP', zh: 'CN', ar: 'SA',
		he: 'IL', hi: 'IN', bn: 'BD', ko: 'KR', tr: 'TR',
		nl: 'NL', pl: 'PL',
	};
	let region;
	if (lower.includes('-')) {
		region = lower.split('-').pop().toUpperCase();
	} else {
		region = (langToRegion[lower] || lower.toUpperCase()).toUpperCase();
	}
	if (region.length !== 2) return lower.toUpperCase();
	return String.fromCodePoint(0x1F1E6 + region.charCodeAt(0) - 65) +
		String.fromCodePoint(0x1F1E6 + region.charCodeAt(1) - 65);
}

// ---------------------------------------------------------------------------
// Live switcher preview — no server round-trip needed.
// ---------------------------------------------------------------------------
function SwitcherPreview({ values, languages }) {
	const langs = (languages || []).filter((l) => l.active);
	if (langs.length === 0) {
		return (
			<p className="ztrans-text-xs ztrans-text-ztrans-muted ztrans-italic">
				{__('Add at least one active language to see the preview.', 'zentranslate')}
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
			<div className="ztrans-inline-block ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-text-sm">
				<div className="ztrans-flex ztrans-cursor-pointer ztrans-items-center ztrans-gap-1 ztrans-px-3 ztrans-py-2 ztrans-font-medium">
					{items.find((i) => i.isDefault)?.label || items[0]?.label}
					<span className="ztrans-text-xs ztrans-text-ztrans-muted">▾</span>
				</div>
				<ul className="ztrans-m-0 ztrans-list-none ztrans-border-t ztrans-border-ztrans-border ztrans-p-0">
					{items.map((item, i) => (
						<li key={i} className={`ztrans-px-3 ztrans-py-1.5 ztrans-text-sm ${item.isDefault ? 'ztrans-font-semibold' : 'ztrans-text-gray-700'}`}>
							{item.label}
						</li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<ul className="ztrans-m-0 ztrans-flex ztrans-list-none ztrans-flex-wrap ztrans-gap-3 ztrans-p-0">
			{items.map((item, i) => (
				<li key={i} className={`ztrans-text-sm ${item.isDefault ? 'ztrans-font-semibold ztrans-text-ztrans-primary' : 'ztrans-text-gray-700'}`}>
					{item.label}
				</li>
			))}
		</ul>
	);
}

export default function SettingsPage() {
	const settings = useSettings();
	const languages = useLanguages();
	const save = useSaveSettings();
	const [values, setValues] = useState(null);
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (settings.data && !values) setValues(settings.data);
	}, [settings.data, values]);

	if (settings.isLoading || !values) return <LoadingBlock>{__('Loading settings…', 'zentranslate')}</LoadingBlock>;

	const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

	const submit = async () => {
		try {
			await save.mutateAsync(values);
			setToast({ tone: 'success', message: __('Settings saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Settings', 'zentranslate')}
				description={__('Configure how Zentranslate behaves.', 'zentranslate')}
				actions={<Button onClick={submit} loading={save.isPending}>{__('Save changes', 'zentranslate')}</Button>}
			/>

			<div className="ztrans-grid ztrans-gap-6 md:ztrans-grid-cols-2">
				<Card title={__('Visitor experience', 'zentranslate')}>
					<Checkbox
						label={__('Auto-redirect first visit by browser language', 'zentranslate')}
						checked={!!values.auto_redirect_browser_lang}
						onChange={(e) => set('auto_redirect_browser_lang', e.target.checked)}
					/>
					<p className="ztrans-mt-1 ztrans-mb-3 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Matches Accept-Language against active languages; 302s once and remembers the choice in a cookie.', 'zentranslate')}
					</p>
					<Checkbox
						label={__('Translate transactional emails per recipient', 'zentranslate')}
						checked={!!values.translate_emails}
						onChange={(e) => set('translate_emails', e.target.checked)}
					/>
					<p className="ztrans-mt-1 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Switches WP locale for the duration of each wp_mail() call to match the recipient\'s Zentranslate preferred language.', 'zentranslate')}
					</p>
				</Card>

				<Card title={__('URL strategy', 'zentranslate')}>
					<Field label={__('Pattern', 'zentranslate')}>
						<Select value={values.url_strategy} onChange={(e) => set('url_strategy', e.target.value)} disabled>
							<option value="subdirectory">{__('Subdirectory (/es/, /fr/)', 'zentranslate')}</option>
						</Select>
					</Field>
					<p className="ztrans-mt-3 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Subdirectory URLs cache cleanly with page-cache plugins. Subdomain and per-domain modes are planned for v2.', 'zentranslate')}
					</p>
				</Card>

				<Card title={__('Display', 'zentranslate')}>
					<Checkbox
						label={__('Show switcher for default language', 'zentranslate')}
						checked={!!values.show_switcher_for_default}
						onChange={(e) => set('show_switcher_for_default', e.target.checked)}
					/>
				</Card>

				<Card title={__('Performance', 'zentranslate')}>
					<Checkbox
						label={__('Use object cache (recommended)', 'zentranslate')}
						checked={!!values.object_cache_enabled}
						onChange={(e) => set('object_cache_enabled', e.target.checked)}
					/>
					<Checkbox
						label={__('Enable debug log', 'zentranslate')}
						checked={!!values.debug_log_enabled}
						onChange={(e) => set('debug_log_enabled', e.target.checked)}
					/>
				</Card>

				<Card title={__('Danger zone', 'zentranslate')}>
					<Checkbox
						label={__('Delete all data on uninstall', 'zentranslate')}
						checked={!!values.remove_data_on_uninstall}
						onChange={(e) => set('remove_data_on_uninstall', e.target.checked)}
					/>
					<p className="ztrans-mt-2 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('When enabled, removing the plugin from WP admin drops all wp_ztrans_* tables and clears Zentranslate options.', 'zentranslate')}
					</p>
				</Card>
			</div>

			{/* ---- Language switcher (full-width below the grid) ---- */}
			<div className="ztrans-mt-6 ztrans-grid ztrans-gap-6 md:ztrans-grid-cols-2">
				<Card title={__('Language switcher appearance', 'zentranslate')}>
					<div className="ztrans-flex ztrans-flex-col ztrans-gap-3">
						<Field label={__('Display style', 'zentranslate')}>
							<Select
								value={values.switcher_display ?? 'inline'}
								onChange={(e) => set('switcher_display', e.target.value)}
							>
								<option value="inline">{__('Inline list', 'zentranslate')}</option>
								<option value="dropdown">{__('Dropdown', 'zentranslate')}</option>
							</Select>
						</Field>

						<Checkbox
							label={__('Show flag emoji', 'zentranslate')}
							checked={values.switcher_show_flag !== false}
							onChange={(e) => set('switcher_show_flag', e.target.checked)}
						/>
						<Checkbox
							label={__('Show language name (English)', 'zentranslate')}
							checked={values.switcher_show_name !== false}
							onChange={(e) => set('switcher_show_name', e.target.checked)}
						/>
						<Checkbox
							label={__('Show native name', 'zentranslate')}
							checked={!!values.switcher_show_native}
							onChange={(e) => set('switcher_show_native', e.target.checked)}
						/>
						<Checkbox
							label={__('Show language code (en, fr…)', 'zentranslate')}
							checked={!!values.switcher_show_code}
							onChange={(e) => set('switcher_show_code', e.target.checked)}
						/>
						<Checkbox
							label={__('Hide current language from the list', 'zentranslate')}
							checked={!!values.switcher_hide_current}
							onChange={(e) => set('switcher_hide_current', e.target.checked)}
						/>
						<Checkbox
							label={__('Show switcher even when only one language is active', 'zentranslate')}
							checked={!!values.switcher_show_if_single}
							onChange={(e) => set('switcher_show_if_single', e.target.checked)}
						/>

						<p className="ztrans-mt-1 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
							{__('These are the defaults for the shortcode, widget, and block. Each instance can override them via its own settings.', 'zentranslate')}
						</p>
					</div>
				</Card>

				<Card title={__('Live preview', 'zentranslate')}>
					<p className="ztrans-mb-3 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Shows how the switcher looks with the current settings. The bold item is the default language.', 'zentranslate')}
					</p>
					<div className="ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-bg-ztrans-bg ztrans-p-4">
						<SwitcherPreview values={values} languages={languages.data} />
					</div>

					<div className="ztrans-mt-5">
						<p className="ztrans-mb-1 ztrans-text-xs ztrans-font-semibold ztrans-text-gray-700">
							{__('Shortcode', 'zentranslate')}
						</p>
						<code className="ztrans-block ztrans-rounded ztrans-bg-gray-100 ztrans-px-3 ztrans-py-2 ztrans-text-xs ztrans-text-gray-800 ztrans-select-all">
							{'[zentranslate_language_switcher]'}
						</code>
						<p className="ztrans-mt-2 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
							{__('Paste anywhere in a post, page, or text widget. Accepts display, show_flag, show_name, show_native, show_code, hide_current attributes to override the defaults above.', 'zentranslate')}
						</p>
					</div>
				</Card>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

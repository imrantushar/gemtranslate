import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Checkbox, Field, Select, TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useSettings, useSaveSettings } from '../../hooks/useSettings';
import { useLanguages } from '../../hooks/useLanguages';
import { usePostTypes } from '../../hooks/usePostTypes';
import { useBackfillAuto } from '../../hooks/useReview';
import { hasFeature } from '../../hooks/useFeatures';
import { UpsellCard } from '../../components/ProGate';
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
			<p className="gtrans-text-xs gtrans-text-gtrans-muted gtrans-italic">
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
			<div className="gtrans-inline-block gtrans-rounded-md gtrans-border gtrans-border-gtrans-border gtrans-bg-white gtrans-text-sm">
				<div className="gtrans-flex gtrans-cursor-pointer gtrans-items-center gtrans-gap-1 gtrans-px-3 gtrans-py-2 gtrans-font-medium">
					{items.find((i) => i.isDefault)?.label || items[0]?.label}
					<span className="gtrans-text-xs gtrans-text-gtrans-muted">▾</span>
				</div>
				<ul className="gtrans-m-0 gtrans-list-none gtrans-border-t gtrans-border-gtrans-border gtrans-p-0">
					{items.map((item, i) => (
						<li
							key={i}
							className={`gtrans-px-3 gtrans-py-1.5 gtrans-text-sm ${
								item.isDefault ? 'gtrans-font-semibold' : 'gtrans-text-gray-700'
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
							? 'gtrans-font-semibold gtrans-text-gtrans-primary'
							: 'gtrans-text-gray-700'
					}`}
				>
					{item.label}
				</li>
			))}
		</ul>
	);
}

export default function SettingsPage() {
	const settings = useSettings();
	const languages = useLanguages();
	const postTypes = usePostTypes();
	const backfillAuto = useBackfillAuto();
	const save = useSaveSettings();
	const [values, setValues] = useState(null);
	const [toast, setToast] = useState(null);
	const [backfill, setBackfill] = useState(null);

	useEffect(() => {
		if (settings.data && !values) setValues(settings.data);
	}, [settings.data, values]);

	if (settings.isLoading || !values)
		return <LoadingBlock>{__('Loading settings…', 'gemtranslate')}</LoadingBlock>;

	const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

	const toggleInArray = (key, item) =>
		setValues((v) => {
			const arr = Array.isArray(v[key]) ? v[key] : [];
			const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
			return { ...v, [key]: next };
		});

	const runBackfill = async () => {
		setBackfill({ running: true, queued: 0, total: 0 });
		try {
			// Persist current settings so the backfill honours them.
			await save.mutateAsync(values);
			let offset = 0;
			let queued = 0;
			let total = 0;
			// Bounded loop — offset advances each call; server flags `done`.
			for (let i = 0; i < 1000; i++) {
				// eslint-disable-next-line no-await-in-loop
				const res = await backfillAuto.mutateAsync({ offset, limit: 200 });
				queued += res.queued || 0;
				offset = res.offset || 0;
				total = res.total || 0;
				setBackfill({ running: !res.done, queued, total });
				if (res.done) break;
			}
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: %d: number of translation jobs queued. */
					__('%d translation jobs queued. Watch progress on the Jobs page.', 'gemtranslate'),
					queued
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setBackfill((b) => ({ ...(b || {}), running: false }));
		}
	};

	const activeTargets = (languages.data || []).filter((l) => !l.is_default && l.active);
	const publicTypes = postTypes.data || [];

	const submit = async () => {
		try {
			await save.mutateAsync(values);
			setToast({
				tone: 'success',
				message: __('Settings saved.', 'gemtranslate'),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Settings', 'gemtranslate')}
				description={__('Configure how GemTranslate behaves.', 'gemtranslate')}
				actions={
					<Button onClick={submit} loading={save.isPending}>
						{__('Save changes', 'gemtranslate')}
					</Button>
				}
			/>

			{/* ---- Translate Everything (automatic translation) ---- */}
			{!hasFeature('translate_everything') ? (
				<div className="gtrans-mb-6">
					<UpsellCard
						title={__('Automatic translation & review queue', 'gemtranslate')}
						description={__(
							'Auto-translate content on publish and review it before it goes live — with GemTranslate Pro.',
							'gemtranslate'
						)}
					/>
				</div>
			) : (
				<div className="gtrans-mb-6">
					<Card title={__('Automatic translation (Translate Everything)', 'gemtranslate')}>
						<Checkbox
							label={__(
								'Automatically translate content when it is published or updated',
								'gemtranslate'
							)}
							checked={!!values.auto_translate}
							onChange={(e) => set('auto_translate', e.target.checked)}
						/>
						<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
							{__(
								'Uses your configured AI provider. Only source-language content is translated; existing translations are never overwritten unless you enable re-translation below.',
								'gemtranslate'
							)}
						</p>

						{!!values.auto_translate && (
							<div className="gtrans-mt-4 gtrans-flex gtrans-flex-col gtrans-gap-4">
								<Field label={__('When a translation is produced', 'gemtranslate')}>
									<Select
										value={values.auto_translate_strategy ?? 'review'}
										onChange={(e) => set('auto_translate_strategy', e.target.value)}
									>
										<option value="review">
											{__('Hold for review (hidden until approved)', 'gemtranslate')}
										</option>
										<option value="publish">
											{__('Publish immediately (go live right away)', 'gemtranslate')}
										</option>
									</Select>
								</Field>

								<div>
									<div className="gtrans-mb-1.5 gtrans-text-sm gtrans-font-medium gtrans-text-gray-700">
										{__('Post types to translate', 'gemtranslate')}
									</div>
									<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-3">
										{(publicTypes.length
											? publicTypes
											: [
													{ name: 'post', label: 'Posts' },
													{ name: 'page', label: 'Pages' },
											  ]
										).map((t) => (
											<Checkbox
												key={t.name}
												label={t.label}
												checked={(values.auto_translate_post_types || []).includes(t.name)}
												onChange={() => toggleInArray('auto_translate_post_types', t.name)}
											/>
										))}
									</div>
								</div>

								<div>
									<div className="gtrans-mb-1.5 gtrans-text-sm gtrans-font-medium gtrans-text-gray-700">
										{__('Target languages', 'gemtranslate')}
									</div>
									{activeTargets.length === 0 ? (
										<p className="gtrans-m-0 gtrans-text-xs gtrans-text-gtrans-muted">
											{__('Add at least one active non-default language first.', 'gemtranslate')}
										</p>
									) : (
										<>
											<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-3">
												{activeTargets.map((l) => (
													<Checkbox
														key={l.code}
														label={l.name}
														checked={
															(values.auto_translate_languages || []).length === 0 ||
															(values.auto_translate_languages || []).includes(l.code)
														}
														onChange={() => toggleInArray('auto_translate_languages', l.code)}
													/>
												))}
											</div>
											<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
												{__(
													'Leave all checked to translate into every active language.',
													'gemtranslate'
												)}
											</p>
										</>
									)}
								</div>

								<Checkbox
									label={__(
										'Re-translate when the source changes (may overwrite AI translations)',
										'gemtranslate'
									)}
									checked={!!values.auto_retranslate_on_update}
									onChange={(e) => set('auto_retranslate_on_update', e.target.checked)}
								/>

								<div className="gtrans-rounded-md gtrans-border gtrans-border-gtrans-border gtrans-bg-gtrans-bg gtrans-p-3">
									<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3">
										<div>
											<div className="gtrans-text-sm gtrans-font-medium gtrans-text-gray-800">
												{__('Translate existing content now', 'gemtranslate')}
											</div>
											<div className="gtrans-text-xs gtrans-text-gtrans-muted">
												{__(
													'Queues jobs for all already-published content using the settings above.',
													'gemtranslate'
												)}
											</div>
										</div>
										<Button
											variant="secondary"
											size="sm"
											onClick={runBackfill}
											loading={backfill?.running}
										>
											{__('Backfill translations', 'gemtranslate')}
										</Button>
									</div>
									{backfill && (backfill.running || backfill.queued > 0) && (
										<div className="gtrans-mt-2 gtrans-text-xs gtrans-text-gray-600">
											{sprintf(
												/* translators: %d: jobs queued so far. */
												__('%d jobs queued so far…', 'gemtranslate'),
												backfill.queued
											)}
										</div>
									)}
								</div>
							</div>
						)}
					</Card>
				</div>
			)}

			<div className="gtrans-grid gtrans-gap-6 md:gtrans-grid-cols-2">
				<Card title={__('Visitor experience', 'gemtranslate')}>
					<Checkbox
						label={__('Auto-redirect first visit by browser language', 'gemtranslate')}
						checked={!!values.auto_redirect_browser_lang}
						onChange={(e) => set('auto_redirect_browser_lang', e.target.checked)}
					/>
					<p className="gtrans-mt-1 gtrans-mb-3 gtrans-text-xs gtrans-text-gtrans-muted">
						{__(
							'Matches Accept-Language against active languages; 302s once and remembers the choice in a cookie.',
							'gemtranslate'
						)}
					</p>
					<Checkbox
						label={__('Translate transactional emails per recipient', 'gemtranslate')}
						checked={!!values.translate_emails}
						onChange={(e) => set('translate_emails', e.target.checked)}
					/>
					<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
						{__(
							"Switches WP locale for the duration of each wp_mail() call to match the recipient's GemTranslate preferred language.",
							'gemtranslate'
						)}
					</p>
				</Card>

				<Card title={__('URL strategy', 'gemtranslate')}>
					<Field label={__('Pattern', 'gemtranslate')}>
						<Select
							value={values.url_strategy}
							onChange={(e) => set('url_strategy', e.target.value)}
							disabled
						>
							<option value="subdirectory">
								{__('Subdirectory (/es/, /fr/)', 'gemtranslate')}
							</option>
						</Select>
					</Field>
					<p className="gtrans-mt-3 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
						{__(
							'Subdirectory URLs cache cleanly with page-cache plugins. Subdomain and per-domain modes are planned for v2.',
							'gemtranslate'
						)}
					</p>
				</Card>

				<Card title={__('Display', 'gemtranslate')}>
					<Checkbox
						label={__('Show switcher for default language', 'gemtranslate')}
						checked={!!values.show_switcher_for_default}
						onChange={(e) => set('show_switcher_for_default', e.target.checked)}
					/>
				</Card>

				<Card title={__('Performance', 'gemtranslate')}>
					<Checkbox
						label={__('Use object cache (recommended)', 'gemtranslate')}
						checked={!!values.object_cache_enabled}
						onChange={(e) => set('object_cache_enabled', e.target.checked)}
					/>
					<Checkbox
						label={__('Enable debug log', 'gemtranslate')}
						checked={!!values.debug_log_enabled}
						onChange={(e) => set('debug_log_enabled', e.target.checked)}
					/>
				</Card>

				<Card title={__('Danger zone', 'gemtranslate')}>
					<Checkbox
						label={__('Delete all data on uninstall', 'gemtranslate')}
						checked={!!values.remove_data_on_uninstall}
						onChange={(e) => set('remove_data_on_uninstall', e.target.checked)}
					/>
					<p className="gtrans-mt-2 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
						{__(
							'When enabled, removing the plugin from WP admin drops all wp_gtrans_* tables and clears GemTranslate options.',
							'gemtranslate'
						)}
					</p>
				</Card>
			</div>

			{/* ---- Language switcher (full-width below the grid) ---- */}
			<div className="gtrans-mt-6 gtrans-grid gtrans-gap-6 md:gtrans-grid-cols-2">
				<Card title={__('Language switcher appearance', 'gemtranslate')}>
					<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
						<Field label={__('Display style', 'gemtranslate')}>
							<Select
								value={values.switcher_display ?? 'inline'}
								onChange={(e) => set('switcher_display', e.target.value)}
							>
								<option value="inline">{__('Inline list', 'gemtranslate')}</option>
								<option value="dropdown">{__('Dropdown', 'gemtranslate')}</option>
							</Select>
						</Field>

						<Checkbox
							label={__('Show flag emoji', 'gemtranslate')}
							checked={values.switcher_show_flag !== false}
							onChange={(e) => set('switcher_show_flag', e.target.checked)}
						/>
						<Checkbox
							label={__('Show language name (English)', 'gemtranslate')}
							checked={values.switcher_show_name !== false}
							onChange={(e) => set('switcher_show_name', e.target.checked)}
						/>
						<Checkbox
							label={__('Show native name', 'gemtranslate')}
							checked={!!values.switcher_show_native}
							onChange={(e) => set('switcher_show_native', e.target.checked)}
						/>
						<Checkbox
							label={__('Show language code (en, fr…)', 'gemtranslate')}
							checked={!!values.switcher_show_code}
							onChange={(e) => set('switcher_show_code', e.target.checked)}
						/>
						<Checkbox
							label={__('Hide current language from the list', 'gemtranslate')}
							checked={!!values.switcher_hide_current}
							onChange={(e) => set('switcher_hide_current', e.target.checked)}
						/>
						<Checkbox
							label={__('Show switcher even when only one language is active', 'gemtranslate')}
							checked={!!values.switcher_show_if_single}
							onChange={(e) => set('switcher_show_if_single', e.target.checked)}
						/>

						<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
							{__(
								'These are the defaults for the shortcode, widget, and block. Each instance can override them via its own settings.',
								'gemtranslate'
							)}
						</p>
					</div>
				</Card>

				<Card title={__('Live preview', 'gemtranslate')}>
					<p className="gtrans-mb-3 gtrans-text-xs gtrans-text-gtrans-muted">
						{__(
							'Shows how the switcher looks with the current settings. The bold item is the default language.',
							'gemtranslate'
						)}
					</p>
					<div className="gtrans-rounded-md gtrans-border gtrans-border-gtrans-border gtrans-bg-gtrans-bg gtrans-p-4">
						<SwitcherPreview values={values} languages={languages.data} />
					</div>

					<div className="gtrans-mt-5">
						<p className="gtrans-mb-1 gtrans-text-xs gtrans-font-semibold gtrans-text-gray-700">
							{__('Shortcode', 'gemtranslate')}
						</p>
						<code className="gtrans-block gtrans-rounded gtrans-bg-gray-100 gtrans-px-3 gtrans-py-2 gtrans-text-xs gtrans-text-gray-800 gtrans-select-all">
							{'[gemtranslate_language_switcher]'}
						</code>
						<p className="gtrans-mt-2 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
							{__(
								'Paste anywhere in a post, page, or text widget. Accepts display, show_flag, show_name, show_native, show_code, hide_current attributes to override the defaults above.',
								'gemtranslate'
							)}
						</p>
					</div>
				</Card>
			</div>

			{/* ---- Country detection ---- */}
			<div className="gtrans-mt-6">
				<Card title={__('Country detection', 'gemtranslate')}>
					<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
						<Checkbox
							label={__('Detect visitor country', 'gemtranslate')}
							checked={!!values.geo_enabled}
							onChange={(e) => set('geo_enabled', e.target.checked)}
						/>
						<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
							{__(
								"When enabled, the visitor's country is detected once per session and used to pick country-specific page variants and (optionally) the default language.",
								'gemtranslate'
							)}
						</p>

						{!!values.geo_enabled && (
							<>
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

								<Checkbox
									label={__(
										"Auto-redirect first visit to country's default language",
										'gemtranslate'
									)}
									checked={!!values.geo_auto_redirect_country}
									onChange={(e) => set('geo_auto_redirect_country', e.target.checked)}
								/>
								<Checkbox
									label={__(
										'Show manual country picker banner when geo source has no match',
										'gemtranslate'
									)}
									checked={!!values.geo_country_picker_banner}
									onChange={(e) => set('geo_country_picker_banner', e.target.checked)}
								/>

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
							</>
						)}
					</div>
				</Card>
			</div>

			{/* ---- Floating language switcher ---- */}
			<div className="gtrans-mt-6">
				<Card title={__('Floating language switcher', 'gemtranslate')}>
					<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
						<Checkbox
							label={__('Show floating switcher on every page', 'gemtranslate')}
							checked={!!values.float_switcher_enabled}
							onChange={(e) => set('float_switcher_enabled', e.target.checked)}
						/>
						<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-xs gtrans-text-gtrans-muted">
							{__(
								'Injects a fixed-position language button on every frontend page — no shortcode or theme edits needed. Visible to all visitors including logged-out users.',
								'gemtranslate'
							)}
						</p>

						{!!values.float_switcher_enabled && (
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
						)}
					</div>
				</Card>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

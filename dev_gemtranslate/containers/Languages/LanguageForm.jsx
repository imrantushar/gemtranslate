import { useState } from 'react';
import { __ } from '@wordpress/i18n';

import Button from '../../components/Button';
import { Field, TextInput, Checkbox } from '../../components/Input';

const PRESETS = [
	{ code: 'es', locale: 'es_ES', name: 'Spanish', native_name: 'Español' },
	{ code: 'fr', locale: 'fr_FR', name: 'French', native_name: 'Français' },
	{ code: 'de', locale: 'de_DE', name: 'German', native_name: 'Deutsch' },
	{ code: 'it', locale: 'it_IT', name: 'Italian', native_name: 'Italiano' },
	{ code: 'pt-br', locale: 'pt_BR', name: 'Portuguese (Brazil)', native_name: 'Português' },
	{ code: 'ja', locale: 'ja', name: 'Japanese', native_name: '日本語' },
	{ code: 'zh-cn', locale: 'zh_CN', name: 'Chinese (Simplified)', native_name: '简体中文' },
	{ code: 'ar', locale: 'ar', name: 'Arabic', native_name: 'العربية', is_rtl: true },
	{ code: 'hi', locale: 'hi_IN', name: 'Hindi', native_name: 'हिन्दी' },
	{ code: 'bn', locale: 'bn_BD', name: 'Bengali', native_name: 'বাংলা' },
];

export default function LanguageForm({ initial, onSubmit, onCancel, busy }) {
	const [values, setValues] = useState(() => ({
		code: initial?.code || '',
		locale: initial?.locale || '',
		name: initial?.name || '',
		native_name: initial?.native_name || '',
		flag: initial?.flag || '',
		is_rtl: !!initial?.is_rtl,
		active: initial?.active ?? true,
		position: initial?.position ?? 10,
		country_codes: Array.isArray(initial?.country_codes) ? initial.country_codes : [],
	}));
	const [countryDraft, setCountryDraft] = useState('');

	const set = (key) => (e) =>
		setValues((v) => ({ ...v, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

	const applyPreset = (preset) => {
		setValues((v) => ({
			...v,
			code: preset.code,
			locale: preset.locale,
			name: preset.name,
			native_name: preset.native_name,
			flag: preset.code,
			is_rtl: !!preset.is_rtl,
		}));
	};

	const addCountry = () => {
		const next = countryDraft.trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(next)) return;
		setValues((v) =>
			v.country_codes.includes(next) ? v : { ...v, country_codes: [...v.country_codes, next] }
		);
		setCountryDraft('');
	};

	const removeCountry = (code) =>
		setValues((v) => ({ ...v, country_codes: v.country_codes.filter((c) => c !== code) }));

	const submit = (e) => {
		e.preventDefault();
		onSubmit(values);
	};

	return (
		<form onSubmit={submit} className="gtrans-flex gtrans-flex-col gtrans-gap-4">
			{!initial && (
				<div>
					<div className="gtrans-mb-2 gtrans-text-xs gtrans-font-medium gtrans-text-label">
						{__('Pick a preset (optional)', 'gemtranslate')}
					</div>
					<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-2">
						{PRESETS.map((p) => (
							<button
								key={p.code}
								type="button"
								onClick={() => applyPreset(p)}
								className="gtrans-bare gtrans-rounded-full gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-3 gtrans-py-1 gtrans-text-xs gtrans-text-label hover:gtrans-bg-body"
							>
								{p.name}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="gtrans-grid gtrans-grid-cols-2 gtrans-gap-4">
				<Field label={__('Code', 'gemtranslate')} hint={__('e.g. en, es, pt-br', 'gemtranslate')}>
					<TextInput value={values.code} onChange={set('code')} required disabled={!!initial} />
				</Field>
				<Field label={__('Locale', 'gemtranslate')} hint={__('WP locale: en_US, es_ES, pt_BR', 'gemtranslate')}>
					<TextInput value={values.locale} onChange={set('locale')} required />
				</Field>
				<Field label={__('Name (English)', 'gemtranslate')}>
					<TextInput value={values.name} onChange={set('name')} required />
				</Field>
				<Field label={__('Native name', 'gemtranslate')}>
					<TextInput value={values.native_name} onChange={set('native_name')} />
				</Field>
				<Field label={__('Flag code', 'gemtranslate')} hint={__('Country code, e.g. ES, FR', 'gemtranslate')}>
					<TextInput value={values.flag} onChange={set('flag')} />
				</Field>
				<Field label={__('Position', 'gemtranslate')} hint={__('Sort order in the switcher', 'gemtranslate')}>
					<TextInput type="number" value={values.position} onChange={set('position')} />
				</Field>
			</div>

			<div className="gtrans-flex gtrans-flex-col gtrans-gap-2">
				<Checkbox label={__('Right-to-left script', 'gemtranslate')} checked={values.is_rtl} onChange={set('is_rtl')} />
				<Checkbox label={__('Active (shown in switcher)', 'gemtranslate')} checked={values.active} onChange={set('active')} />
			</div>

			<Field
				label={__('Countries where this is the default language', 'gemtranslate')}
				hint={__('ISO 3166-1 alpha-2 codes (e.g. MX, ES, AR). Used for country-based auto-redirect.', 'gemtranslate')}
			>
				<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2">
					{values.country_codes.map((c) => (
						<span
							key={c}
							className="gtrans-inline-flex gtrans-items-center gtrans-gap-1 gtrans-rounded-full gtrans-bg-body gtrans-px-2 gtrans-py-0.5 gtrans-text-xs gtrans-text-label"
						>
							{c}
							<button
								type="button"
								onClick={() => removeCountry(c)}
								className="gtrans-bare gtrans-text-muted hover:gtrans-text-red-600"
								aria-label={__('Remove', 'gemtranslate')}
							>
								×
							</button>
						</span>
					))}
					<TextInput
						value={countryDraft}
						maxLength={2}
						placeholder={__('e.g. MX', 'gemtranslate')}
						onChange={(e) => setCountryDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addCountry();
							}
						}}
						style={{ width: '6rem' }}
					/>
					<Button type="button" variant="ghost" size="sm" onClick={addCountry}>
						{__('Add', 'gemtranslate')}
					</Button>
				</div>
			</Field>

			<div className="gtrans-flex gtrans-justify-end gtrans-gap-2">
				<Button variant="ghost" type="button" onClick={onCancel}>{__('Cancel', 'gemtranslate')}</Button>
				<Button type="submit" loading={busy}>
					{initial ? __('Save changes', 'gemtranslate') : __('Add language', 'gemtranslate')}
				</Button>
			</div>
		</form>
	);
}

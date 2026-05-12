import { useState } from 'react';
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
	}));

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

	const submit = (e) => {
		e.preventDefault();
		onSubmit(values);
	};

	return (
		<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-4">
			{!initial && (
				<div>
					<div className="ztrans-mb-2 ztrans-text-xs ztrans-font-medium ztrans-text-gray-700">Pick a preset (optional)</div>
					<div className="ztrans-flex ztrans-flex-wrap ztrans-gap-2">
						{PRESETS.map((p) => (
							<button
								key={p.code}
								type="button"
								onClick={() => applyPreset(p)}
								className="ztrans-bare ztrans-rounded-full ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-px-3 ztrans-py-1 ztrans-text-xs ztrans-text-gray-700 hover:ztrans-bg-gray-50"
							>
								{p.name}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="ztrans-grid ztrans-grid-cols-2 ztrans-gap-4">
				<Field label="Code" hint="e.g. en, es, pt-br">
					<TextInput value={values.code} onChange={set('code')} required disabled={!!initial} />
				</Field>
				<Field label="Locale" hint="WP locale: en_US, es_ES, pt_BR">
					<TextInput value={values.locale} onChange={set('locale')} required />
				</Field>
				<Field label="Name (English)">
					<TextInput value={values.name} onChange={set('name')} required />
				</Field>
				<Field label="Native name">
					<TextInput value={values.native_name} onChange={set('native_name')} />
				</Field>
				<Field label="Flag code" hint="Country code, e.g. ES, FR">
					<TextInput value={values.flag} onChange={set('flag')} />
				</Field>
				<Field label="Position" hint="Sort order in the switcher">
					<TextInput type="number" value={values.position} onChange={set('position')} />
				</Field>
			</div>

			<div className="ztrans-flex ztrans-flex-col ztrans-gap-2">
				<Checkbox label="Right-to-left script" checked={values.is_rtl} onChange={set('is_rtl')} />
				<Checkbox label="Active (shown in switcher)" checked={values.active} onChange={set('active')} />
			</div>

			<div className="ztrans-flex ztrans-justify-end ztrans-gap-2">
				<Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
				<Button type="submit" loading={busy}>{initial ? 'Save changes' : 'Add language'}</Button>
			</div>
		</form>
	);
}

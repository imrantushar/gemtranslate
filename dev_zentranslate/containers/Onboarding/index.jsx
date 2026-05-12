import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Checkbox, Field, TextInput, Select } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useLanguages, useCreateLanguage } from '../../hooks/useLanguages';
import { useAIProviders, useSaveAIProviders, useTestAIProvider } from '../../hooks/useAI';
import { useSaveSettings } from '../../hooks/useSettings';
import { formatErrorMessage } from '../../lib/format';

const QUICK_LANGS = [
	{ code: 'es', locale: 'es_ES', name: 'Spanish', native_name: 'Español' },
	{ code: 'fr', locale: 'fr_FR', name: 'French', native_name: 'Français' },
	{ code: 'de', locale: 'de_DE', name: 'German', native_name: 'Deutsch' },
	{ code: 'it', locale: 'it_IT', name: 'Italian', native_name: 'Italiano' },
	{ code: 'pt-br', locale: 'pt_BR', name: 'Portuguese (Brazil)', native_name: 'Português' },
	{ code: 'ja', locale: 'ja', name: 'Japanese', native_name: '日本語' },
	{ code: 'zh-cn', locale: 'zh_CN', name: 'Chinese (Simplified)', native_name: '简体中文' },
	{ code: 'ar', locale: 'ar', name: 'Arabic', native_name: 'العربية', is_rtl: true },
];

const STEPS = [
	{ key: 'welcome', label: () => __('Welcome', 'zentranslate') },
	{ key: 'languages', label: () => __('Languages', 'zentranslate') },
	{ key: 'ai', label: () => __('AI provider', 'zentranslate') },
	{ key: 'done', label: () => __('Done', 'zentranslate') },
];

export default function Onboarding() {
	const navigate = useNavigate();
	const languages = useLanguages();
	const createLang = useCreateLanguage();
	const providers = useAIProviders();
	const saveProviders = useSaveAIProviders();
	const testProvider = useTestAIProvider();
	const saveSettings = useSaveSettings();

	const [step, setStep] = useState('welcome');
	const [picked, setPicked] = useState([]);
	const [aiProvider, setAiProvider] = useState('openai');
	const [aiKey, setAiKey] = useState('');
	const [aiModel, setAiModel] = useState('gpt-4o-mini');
	const [toast, setToast] = useState(null);
	const [working, setWorking] = useState(false);

	if (languages.isLoading || providers.isLoading) return <LoadingBlock>{__('Loading…', 'zentranslate')}</LoadingBlock>;

	const existingCodes = new Set((languages.data || []).map((l) => l.code));
	const togglePick = (code) =>
		setPicked((p) => p.includes(code) ? p.filter((x) => x !== code) : [ ...p, code ]);

	const goNext = () => {
		const i = STEPS.findIndex((s) => s.key === step);
		if (i < STEPS.length - 1) setStep(STEPS[i + 1].key);
	};
	const goBack = () => {
		const i = STEPS.findIndex((s) => s.key === step);
		if (i > 0) setStep(STEPS[i - 1].key);
	};

	const saveLanguages = async () => {
		setWorking(true);
		try {
			for (const code of picked) {
				if (existingCodes.has(code)) continue;
				const preset = QUICK_LANGS.find((p) => p.code === code);
				if (!preset) continue;
				await createLang.mutateAsync({
					code: preset.code,
					locale: preset.locale,
					name: preset.name,
					native_name: preset.native_name,
					flag: preset.code,
					is_rtl: !!preset.is_rtl,
					active: true,
					position: 10,
				});
			}
			setToast({ tone: 'success', message: __('Languages added.', 'zentranslate') });
			goNext();
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setWorking(false);
		}
	};

	const saveAi = async () => {
		if (!aiKey) {
			goNext();
			return;
		}
		setWorking(true);
		try {
			await testProvider.mutateAsync({ name: aiProvider, api_key: aiKey, model: aiModel });
			await saveProviders.mutateAsync({
				default: aiProvider,
				providers: {
					[aiProvider]: { api_key: aiKey, ...(aiProvider === 'openai' ? { model: aiModel } : {}) },
				},
			});
			setToast({ tone: 'success', message: __('AI provider configured.', 'zentranslate') });
			goNext();
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setWorking(false);
		}
	};

	const finish = async () => {
		setWorking(true);
		try {
			await saveSettings.mutateAsync({ onboarding_complete: true });
		} catch (err) {
			// non-fatal; mark via current settings shape
		} finally {
			setWorking(false);
			navigate('/dashboard');
		}
	};

	return (
		<>
			<PageHeader
				title={__('Welcome to Zentranslate', 'zentranslate')}
				description={__('Quick setup — pick languages, add an AI key (optional), done.', 'zentranslate')}
			/>

			<div className="ztrans-mb-6 ztrans-flex ztrans-items-center ztrans-gap-2">
				{STEPS.map((s, i) => (
					<div key={s.key} className="ztrans-flex ztrans-items-center ztrans-gap-2">
						<span
							className={`ztrans-flex ztrans-h-6 ztrans-w-6 ztrans-items-center ztrans-justify-center ztrans-rounded-full ztrans-text-xs ${
								STEPS.findIndex((x) => x.key === step) >= i
									? 'ztrans-bg-ztrans-primary ztrans-text-white'
									: 'ztrans-bg-ztrans-border ztrans-text-gray-600'
							}`}
						>
							{i + 1}
						</span>
						<span className="ztrans-text-sm ztrans-text-gray-700">{s.label()}</span>
						{i < STEPS.length - 1 && <span className="ztrans-text-ztrans-muted">→</span>}
					</div>
				))}
			</div>

			{step === 'welcome' && (
				<Card>
					<p className="ztrans-text-sm ztrans-text-gray-700">
						{__('Zentranslate makes your WordPress site multilingual without slowing it down. We\'ll set up your languages, optionally connect an AI translator, and you\'ll be ready to translate.', 'zentranslate')}
					</p>
					<div className="ztrans-mt-4 ztrans-flex ztrans-justify-end">
						<Button onClick={goNext}>{__('Get started', 'zentranslate')}</Button>
					</div>
				</Card>
			)}

			{step === 'languages' && (
				<Card title={__('Pick the languages you want to support', 'zentranslate')}>
					<div className="ztrans-grid ztrans-grid-cols-2 md:ztrans-grid-cols-3 ztrans-gap-2">
						{QUICK_LANGS.map((l) => {
							const already = existingCodes.has(l.code);
							const isPicked = picked.includes(l.code);
							return (
								<button
									key={l.code}
									type="button"
									disabled={already}
									onClick={() => togglePick(l.code)}
									className={`ztrans-bare ztrans-rounded-md ztrans-border ztrans-px-3 ztrans-py-2 ztrans-text-left ztrans-text-sm ${
										already
											? 'ztrans-border-ztrans-border ztrans-bg-ztrans-bg ztrans-text-ztrans-muted ztrans-cursor-not-allowed'
											: isPicked
												? 'ztrans-border-ztrans-primary ztrans-bg-blue-50 ztrans-text-ztrans-primary'
												: 'ztrans-border-ztrans-border ztrans-bg-white ztrans-text-gray-700 hover:ztrans-bg-gray-50'
									}`}
								>
									<div className="ztrans-font-medium">{l.name}</div>
									<div className="ztrans-text-xs">{l.native_name} · {l.code}</div>
									{already && <div className="ztrans-mt-1 ztrans-text-xs">{__('(already added)', 'zentranslate')}</div>}
								</button>
							);
						})}
					</div>
					<div className="ztrans-mt-4 ztrans-flex ztrans-justify-between">
						<Button variant="ghost" onClick={goBack}>{__('Back', 'zentranslate')}</Button>
						<div className="ztrans-flex ztrans-gap-2">
							<Button variant="secondary" onClick={goNext}>{__('Skip', 'zentranslate')}</Button>
							<Button onClick={saveLanguages} loading={working} disabled={picked.length === 0}>
								{__('Add and continue', 'zentranslate')}
							</Button>
						</div>
					</div>
				</Card>
			)}

			{step === 'ai' && (
				<Card title={__('Optional: connect an AI translator', 'zentranslate')}>
					<p className="ztrans-mb-4 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Bring your own API key. Skip to set up later from AI Translation.', 'zentranslate')}
					</p>
					<div className="ztrans-grid ztrans-grid-cols-1 md:ztrans-grid-cols-3 ztrans-gap-4">
						<Field label={__('Provider', 'zentranslate')}>
							<Select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
								<option value="openai">OpenAI</option>
								<option value="deepl">DeepL</option>
								<option value="google">Google</option>
							</Select>
						</Field>
						<Field label={__('API key', 'zentranslate')}>
							<TextInput type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="sk-…" />
						</Field>
						{aiProvider === 'openai' && (
							<Field label={__('Model', 'zentranslate')} hint={__('Default: gpt-4o-mini', 'zentranslate')}>
								<TextInput value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
							</Field>
						)}
					</div>
					<div className="ztrans-mt-4 ztrans-flex ztrans-justify-between">
						<Button variant="ghost" onClick={goBack}>{__('Back', 'zentranslate')}</Button>
						<div className="ztrans-flex ztrans-gap-2">
							<Button variant="secondary" onClick={goNext}>{__('Skip', 'zentranslate')}</Button>
							<Button onClick={saveAi} loading={working}>{__('Test & save', 'zentranslate')}</Button>
						</div>
					</div>
				</Card>
			)}

			{step === 'done' && (
				<Card>
					<p className="ztrans-text-sm ztrans-text-gray-700">
						{__('All set! Head to Posts to translate your first article, or Strings to translate theme/plugin labels.', 'zentranslate')}
					</p>
					<div className="ztrans-mt-4 ztrans-flex ztrans-justify-end">
						<Button onClick={finish} loading={working}>{__('Go to dashboard', 'zentranslate')}</Button>
					</div>
				</Card>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

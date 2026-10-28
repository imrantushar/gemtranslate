import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import Stepper from '../../components/Stepper';
import { PageSkeleton } from '../../components/Skeleton';
import { useLanguages, useCreateLanguage } from '../../hooks/useLanguages';
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
	{ code: 'hi', locale: 'hi_IN', name: 'Hindi', native_name: 'हिन्दी' },
	{ code: 'ko', locale: 'ko_KR', name: 'Korean', native_name: '한국어' },
	{ code: 'tr', locale: 'tr_TR', name: 'Turkish', native_name: 'Türkçe' },
	{ code: 'nl', locale: 'nl_NL', name: 'Dutch', native_name: 'Nederlands' },
	{ code: 'pl', locale: 'pl_PL', name: 'Polish', native_name: 'Polski' },
];

const STEPS = [
	{ key: 'welcome', label: () => __('Welcome', 'gemtranslate') },
	{ key: 'languages', label: () => __('Languages', 'gemtranslate') },
	{ key: 'done', label: () => __('Done', 'gemtranslate') },
];

export default function Onboarding() {
	const navigate = useNavigate();
	const languages = useLanguages();
	const createLang = useCreateLanguage();
	const saveSettings = useSaveSettings();

	const [step, setStep] = useState('welcome');
	const [picked, setPicked] = useState([]);
	const [toast, setToast] = useState(null);
	const [working, setWorking] = useState(false);

	if (languages.isLoading) return <PageSkeleton />;

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
			setToast({ tone: 'success', message: __('Languages added.', 'gemtranslate') });
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
				title={__('Welcome to GemTranslate', 'gemtranslate')}
				description={__('Quick setup — pick your languages and you\'re ready.', 'gemtranslate')}
			/>

			<div className="gtrans-mb-6 gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-px-6 gtrans-py-4">
				<Stepper
					steps={STEPS}
					currentStepIndex={STEPS.findIndex((s) => s.key === step)}
					onStepClick={(i) => setStep(STEPS[i].key)}
				/>
			</div>

			{step === 'welcome' && (
				<Card>
					<p className="gtrans-text-sm gtrans-text-label">
						{__('GemTranslate makes your WordPress site multilingual without slowing it down. We\'ll set up your languages and you\'ll be ready to translate.', 'gemtranslate')}
					</p>
					<div className="gtrans-mt-4 gtrans-flex gtrans-justify-end">
						<Button onClick={goNext}>{__('Get started', 'gemtranslate')}</Button>
					</div>
				</Card>
			)}

			{step === 'languages' && (
				<Card title={__('Pick the languages you want to support', 'gemtranslate')}>
					<div className="gtrans-grid gtrans-grid-cols-2 md:gtrans-grid-cols-3 gtrans-gap-2">
						{QUICK_LANGS.map((l) => {
							const already = existingCodes.has(l.code);
							const isPicked = picked.includes(l.code);
							return (
								<button
									key={l.code}
									type="button"
									disabled={already}
									onClick={() => togglePick(l.code)}
									className={`gtrans-bare gtrans-rounded-md gtrans-border gtrans-px-3 gtrans-py-2 gtrans-text-left gtrans-text-sm ${
										already
											? 'gtrans-border-line gtrans-bg-body gtrans-text-muted gtrans-cursor-not-allowed'
											: isPicked
												? 'gtrans-border-primary gtrans-bg-blue-50 gtrans-text-primary'
												: 'gtrans-border-line gtrans-bg-surface gtrans-text-label hover:gtrans-bg-body'
									}`}
								>
									<div className="gtrans-font-medium">{l.name}</div>
									<div className="gtrans-text-xs">{l.native_name} · {l.code}</div>
									{already && <div className="gtrans-mt-1 gtrans-text-xs">{__('(already added)', 'gemtranslate')}</div>}
								</button>
							);
						})}
					</div>
					<div className="gtrans-mt-4 gtrans-flex gtrans-justify-between">
						<Button variant="ghost" onClick={goBack}>{__('Back', 'gemtranslate')}</Button>
						<div className="gtrans-flex gtrans-gap-2">
							<Button variant="secondary" onClick={goNext}>{__('Skip', 'gemtranslate')}</Button>
							<Button onClick={saveLanguages} loading={working} disabled={picked.length === 0}>
								{__('Add and continue', 'gemtranslate')}
							</Button>
						</div>
					</div>
				</Card>
			)}

			{step === 'done' && (
				<Card>
					<p className="gtrans-text-sm gtrans-text-label">
						{__('All set! Head to Posts to translate your first article, or Strings to translate theme/plugin labels.', 'gemtranslate')}
					</p>
					<div className="gtrans-mt-4 gtrans-flex gtrans-justify-end">
						<Button onClick={finish} loading={working}>{__('Go to dashboard', 'gemtranslate')}</Button>
					</div>
				</Card>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

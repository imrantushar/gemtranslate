import { useState } from 'react';
import clsx from 'clsx';
import { __ } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';

import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Toast from '../../components/Toast';
import { SettingRow } from '../../components/Switch';
import { PageSkeleton } from '../../components/Skeleton';
import { useLanguages, useCreateLanguage } from '../../hooks/useLanguages';
import { useSettings, useSaveSettings } from '../../hooks/useSettings';
import { formatErrorMessage } from '../../lib/format';
import Logo from './Logo';
import Welcome from './Welcome';
import Congratulation from './Congratulation';

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
	{ key: 'languages', label: () => __('Languages', 'gemtranslate') },
	{ key: 'preferences', label: () => __('Preferences', 'gemtranslate') },
];

/** Step heading — title + one-line sub-heading, same rhythm as StoreEngine's FormHeading. */
function StepHeading({ title, subtitle }) {
	return (
		<div>
			<h2 className="gtrans-m-0 gtrans-text-2xl gtrans-font-bold gtrans-tracking-tight gtrans-text-heading">{title}</h2>
			<p className="gtrans-mb-0 gtrans-mt-1.5 gtrans-text-sm gtrans-text-description">{subtitle}</p>
		</div>
	);
}

/** Top bar: logo · compact numbered stepper · skip + close. */
function SetupBar({ stepIndex, onSkip, onClose }) {
	return (
		<div className="gtrans-grid gtrans-w-full gtrans-grid-cols-[1fr_auto_1fr] gtrans-items-center gtrans-gap-6 gtrans-border-b gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-px-6 gtrans-py-3.5">
			<Logo small className="gtrans-justify-self-start" />

			<ol className="gtrans-m-0 gtrans-flex gtrans-list-none gtrans-flex-wrap gtrans-items-center gtrans-justify-center gtrans-gap-x-2 gtrans-gap-y-2 gtrans-p-0 gtrans-justify-self-center">
				{STEPS.map((step, idx) => {
					const done = stepIndex > idx;
					const active = stepIndex === idx;
					return (
						<li key={step.key} className="gtrans-m-0 gtrans-flex gtrans-items-center gtrans-gap-2">
							<span
								className={clsx(
									'gtrans-flex gtrans-h-6 gtrans-w-6 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-border gtrans-border-solid gtrans-text-[11px] gtrans-font-bold gtrans-transition-colors',
									done && 'gtrans-border-success gtrans-bg-success gtrans-text-white',
									active && 'gtrans-border-primary gtrans-bg-primary-light gtrans-text-primary',
									!done && !active && 'gtrans-border-line gtrans-bg-surface gtrans-text-description'
								)}
							>
								{done ? <Icon name="check" size={12} /> : idx + 1}
							</span>
							<span
								className={clsx(
									'gtrans-whitespace-nowrap gtrans-text-[12.5px] gtrans-font-semibold',
									active ? 'gtrans-text-primary' : done ? 'gtrans-text-ink' : 'gtrans-text-description'
								)}
							>
								{step.label()}
							</span>
							{idx !== STEPS.length - 1 && <span className="gtrans-mx-1 gtrans-h-px gtrans-w-6 gtrans-bg-line" aria-hidden="true" />}
						</li>
					);
				})}
			</ol>

			<div className="gtrans-flex gtrans-shrink-0 gtrans-items-center gtrans-gap-3 gtrans-justify-self-end">
				<button
					type="button"
					onClick={onSkip}
					className="gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-bg-transparent gtrans-text-[13px] gtrans-font-semibold gtrans-text-placeholder hover:gtrans-text-primary"
				>
					{__('Skip', 'gemtranslate')}
				</button>
				<button
					type="button"
					onClick={onClose}
					aria-label={__('Close setup', 'gemtranslate')}
					className="gtrans-bare gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-body gtrans-p-0 gtrans-text-description hover:gtrans-border-primary hover:gtrans-text-ink"
				>
					<Icon name="x" size={14} />
				</button>
			</div>
		</div>
	);
}

function LanguageCard({ lang, already, picked, onToggle }) {
	return (
		<button
			type="button"
			disabled={already}
			aria-pressed={picked}
			onClick={onToggle}
			className={clsx(
				'gtrans-bare gtrans-relative gtrans-flex gtrans-flex-col gtrans-gap-1 gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-p-3 gtrans-text-left gtrans-transition-colors',
				already
					? 'gtrans-cursor-not-allowed gtrans-border-line gtrans-bg-body gtrans-opacity-60'
					: picked
						? 'gtrans-cursor-pointer gtrans-border-primary gtrans-bg-primary-light'
						: 'gtrans-cursor-pointer gtrans-border-line gtrans-bg-surface hover:gtrans-border-primary'
			)}
		>
			<span className="gtrans-text-sm gtrans-font-semibold gtrans-leading-tight gtrans-text-ink">{lang.name}</span>
			<span className="gtrans-text-xs gtrans-text-description">{lang.native_name} · {lang.code}</span>
			{already && <span className="gtrans-text-[11px] gtrans-font-semibold gtrans-text-success">{__('Already added', 'gemtranslate')}</span>}
			{picked && !already && (
				<span className="gtrans-absolute gtrans-right-3 gtrans-top-3 gtrans-flex gtrans-h-5 gtrans-w-5 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-bg-primary gtrans-text-white" aria-hidden="true">
					<Icon name="check" size={11} />
				</span>
			)}
		</button>
	);
}

export default function Onboarding() {
	const navigate = useNavigate();
	const languages = useLanguages();
	const settings = useSettings();
	const createLang = useCreateLanguage();
	const saveSettings = useSaveSettings();

	const [screen, setScreen] = useState('welcome'); // welcome | steps | done
	const [stepIndex, setStepIndex] = useState(0);
	const [picked, setPicked] = useState([]);
	const [prefs, setPrefs] = useState({ auto_redirect_browser_lang: false, show_switcher_for_default: true });
	const [toast, setToast] = useState(null);
	const [working, setWorking] = useState(false);

	const existingCodes = new Set((languages.data || []).map((l) => l.code));
	const togglePick = (code) => setPicked((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));

	// Persist `onboarding_complete` so FirstRunGate stops bouncing back here.
	const complete = async (extra = {}) => {
		try {
			await saveSettings.mutateAsync({ onboarding_complete: true, ...extra });
			return true;
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
			return false;
		}
	};

	const exit = async () => {
		setWorking(true);
		const ok = await complete();
		setWorking(false);
		if (ok) navigate('/dashboard');
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
			setPicked([]);
			setStepIndex(1);
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setWorking(false);
		}
	};

	const finish = async () => {
		setWorking(true);
		const ok = await complete(prefs);
		setWorking(false);
		if (ok) setScreen('done');
	};

	// Skip advances one step; skipping the last step finishes without saving prefs.
	const skipStep = async () => {
		if (stepIndex < STEPS.length - 1) {
			setStepIndex(stepIndex + 1);
			return;
		}
		setWorking(true);
		const ok = await complete();
		setWorking(false);
		if (ok) setScreen('done');
	};

	let body;
	if (languages.isLoading || settings.isLoading) {
		body = <div className="gtrans-p-6"><PageSkeleton /></div>;
	} else if (screen === 'welcome') {
		body = <Welcome onStart={() => setScreen('steps')} onSkip={exit} skipping={working} />;
	} else if (screen === 'done') {
		body = <Congratulation languageCount={(languages.data || []).length} />;
	} else {
		body = (
			<>
				<SetupBar stepIndex={stepIndex} onSkip={skipStep} onClose={exit} />
				<div className="gtrans-w-full gtrans-px-6 gtrans-pb-10 gtrans-pt-16">
					<div className="gtrans-mx-auto gtrans-w-full gtrans-max-w-[820px]">
						{stepIndex === 0 && (
							<>
								<StepHeading
									title={__('Which languages will you offer?', 'gemtranslate')}
									subtitle={__('Pick the languages you want visitors to switch to. You can add more any time.', 'gemtranslate')}
								/>
								<div className="gtrans-mt-6 gtrans-grid gtrans-grid-cols-2 gtrans-gap-3 md:gtrans-grid-cols-3">
									{QUICK_LANGS.map((l) => (
										<LanguageCard
											key={l.code}
											lang={l}
											already={existingCodes.has(l.code)}
											picked={picked.includes(l.code)}
											onToggle={() => togglePick(l.code)}
										/>
									))}
								</div>
							</>
						)}

						{stepIndex === 1 && (
							<>
								<StepHeading
									title={__('How should your site behave?', 'gemtranslate')}
									subtitle={__('Two quick preferences — both can be changed later in Settings.', 'gemtranslate')}
								/>
								<div className="gtrans-mt-6 gtrans-divide-y gtrans-divide-solid gtrans-divide-divider gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-px-5">
									<SettingRow
										label={__('Redirect visitors to their browser language', 'gemtranslate')}
										description={__('On a first visit, send people to the translation that matches their browser.', 'gemtranslate')}
										checked={prefs.auto_redirect_browser_lang}
										onChange={(v) => setPrefs((p) => ({ ...p, auto_redirect_browser_lang: v }))}
									/>
									<SettingRow
										label={__('Show the default language in the switcher', 'gemtranslate')}
										description={__('Lets visitors jump back to your original language.', 'gemtranslate')}
										checked={prefs.show_switcher_for_default}
										onChange={(v) => setPrefs((p) => ({ ...p, show_switcher_for_default: v }))}
									/>
								</div>
							</>
						)}

						<div className="gtrans-mt-10 gtrans-flex gtrans-justify-between">
							<Button variant="ghost" onClick={() => setStepIndex(stepIndex - 1)} disabled={stepIndex === 0 || working}>
								{__('Back', 'gemtranslate')}
							</Button>
							<Button onClick={stepIndex === 0 ? saveLanguages : finish} loading={working}>
								{stepIndex === STEPS.length - 1 ? __('Finish', 'gemtranslate') : __('Continue', 'gemtranslate')}
								<Icon name="chevron" size={16} />
							</Button>
						</div>
					</div>
				</div>
			</>
		);
	}

	// Full-screen overlay: covers the wp-admin bar and menu, like StoreEngine's
	// standalone setup screen, so setup reads as its own focused flow.
	return (
		<div className="gtrans-onboarding gtrans-fixed gtrans-inset-0 gtrans-z-[100000] gtrans-overflow-y-auto gtrans-bg-surface">
			{body}
			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</div>
	);
}

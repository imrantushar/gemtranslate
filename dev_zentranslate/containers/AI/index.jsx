import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, Select, TextInput, Checkbox } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import {
	useAIProviders,
	useSaveAIProviders,
	useTestAIProvider,
	useMemoryStats,
} from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';
import { hasFeature } from '../../hooks/useFeatures';
import { UpsellCard } from '../../components/ProGate';

const PROVIDERS = [
	{
		key: 'openai',
		label: 'OpenAI',
		hint: () => __('Uses GPT models. Best quality, BYOK.', 'zentranslate'),
	},
	{
		key: 'deepl',
		label: 'DeepL',
		hint: () => __('Specialized translation API. BYOK.', 'zentranslate'),
	},
	{
		key: 'google',
		label: 'Google',
		hint: () => __('Cloud Translation v2 (API key auth).', 'zentranslate'),
	},
	{
		key: 'cloud',
		label: 'Zentranslate Cloud',
		hint: () =>
			__('Hosted proxy with credit packs. Set the endpoint and license key.', 'zentranslate'),
	},
];

export default function AIPage() {
	const providers = useAIProviders();
	const save = useSaveAIProviders();
	const test = useTestAIProvider();
	const memory = useMemoryStats();
	const [state, setState] = useState(null);
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (providers.data && !state) {
			setState(providers.data);
		}
	}, [providers.data, state]);

	if (providers.isLoading || !state)
		return <LoadingBlock>{__('Loading AI providers…', 'zentranslate')}</LoadingBlock>;

	const update = (name, key, value) =>
		setState((s) => ({
			...s,
			providers: {
				...s.providers,
				[name]: { ...(s.providers[name] || {}), [key]: value },
			},
		}));

	const onSave = async () => {
		try {
			await save.mutateAsync(state);
			setToast({ tone: 'success', message: __('AI providers saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onTest = async (name) => {
		const cfg = state.providers[name] || {};
		const payload = {};
		if (cfg.api_key && !String(cfg.api_key).startsWith('••••')) {
			payload.api_key = cfg.api_key;
		}
		if (cfg.model) payload.model = cfg.model;
		if (cfg.use_pro) payload.use_pro = cfg.use_pro;
		if (cfg.endpoint) payload.endpoint = cfg.endpoint;

		try {
			await test.mutateAsync({ name, ...payload });
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: %s: provider name (openai, deepl, google). */
					__('%s credentials work.', 'zentranslate'),
					name
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('AI Translation', 'zentranslate')}
				description={__(
					'Connect your own AI provider keys. Translations stay on your site.',
					'zentranslate'
				)}
				actions={
					<Button onClick={onSave} loading={save.isPending}>
						{__('Save changes', 'zentranslate')}
					</Button>
				}
			/>

			<Card title={__('Default provider', 'zentranslate')} className="ztrans-mb-6">
				<Field label={__("Used when 'Translate with AI' is clicked", 'zentranslate')}>
					<Select
						value={state.default || ''}
						onChange={(e) => setState((s) => ({ ...s, default: e.target.value }))}
					>
						<option value="">{__('— Pick one —', 'zentranslate')}</option>
						{PROVIDERS.map((p) => (
							<option key={p.key} value={p.key}>
								{p.label}
							</option>
						))}
					</Select>
				</Field>
			</Card>

			<div className="ztrans-grid ztrans-gap-6 lg:ztrans-grid-cols-3">
				{PROVIDERS.map((p) => {
					const cfg = state.providers[p.key] || {};
					return (
						<Card key={p.key} title={p.label}>
							<p className="ztrans-mb-3 ztrans-text-xs ztrans-text-ztrans-muted">{p.hint()}</p>
							<div className="ztrans-flex ztrans-flex-col ztrans-gap-3">
								<Field
									label={__('API key', 'zentranslate')}
									hint={
										cfg.has_key
											? __('Key saved. Enter a new value to replace.', 'zentranslate')
											: __('Required.', 'zentranslate')
									}
								>
									<TextInput
										value={cfg.api_key || ''}
										onChange={(e) => update(p.key, 'api_key', e.target.value)}
										placeholder={cfg.has_key ? cfg.api_key : 'sk-…'}
										type="password"
									/>
								</Field>
								{p.key === 'openai' && (
									<Field
										label={__('Model', 'zentranslate')}
										hint={__('Default: gpt-4o-mini', 'zentranslate')}
									>
										<TextInput
											value={cfg.model || ''}
											onChange={(e) => update(p.key, 'model', e.target.value)}
											placeholder="gpt-4o-mini"
										/>
									</Field>
								)}
								{p.key === 'deepl' && (
									<Checkbox
										label={__('Use DeepL Pro endpoint', 'zentranslate')}
										checked={!!cfg.use_pro}
										onChange={(e) => update(p.key, 'use_pro', e.target.checked)}
									/>
								)}
								{p.key === 'cloud' && (
									<Field
										label={__('Cloud endpoint', 'zentranslate')}
										hint={__('https://your-zentranslate-cloud.example.com', 'zentranslate')}
									>
										<TextInput
											value={cfg.endpoint || ''}
											onChange={(e) => update(p.key, 'endpoint', e.target.value)}
											placeholder="https://"
										/>
									</Field>
								)}
								<Button
									variant="secondary"
									size="sm"
									onClick={() => onTest(p.key)}
									loading={test.isPending}
								>
									{__('Test credentials', 'zentranslate')}
								</Button>
							</div>
						</Card>
					);
				})}
			</div>

			{hasFeature('translation_memory') ? (
				<Card title={__('Translation memory', 'zentranslate')} className="ztrans-mt-6">
					{memory.isLoading ? (
						<LoadingBlock>{__('Loading memory stats…', 'zentranslate')}</LoadingBlock>
					) : (
						<div className="ztrans-grid ztrans-grid-cols-2 ztrans-gap-4 ztrans-text-sm">
							<div>
								<div className="ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
									{__('Cached entries', 'zentranslate')}
								</div>
								<div className="ztrans-mt-1 ztrans-text-xl ztrans-font-semibold">
									{memory.data?.entries ?? 0}
								</div>
							</div>
							<div>
								<div className="ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
									{__('Reuse hits', 'zentranslate')}
								</div>
								<div className="ztrans-mt-1 ztrans-text-xl ztrans-font-semibold">
									{memory.data?.hits ?? 0}
								</div>
							</div>
						</div>
					)}
				</Card>
			) : (
				<div className="ztrans-mt-6">
					<UpsellCard
						title={__('Translation memory & glossary', 'zentranslate')}
						description={__(
							'Reuse past translations to cut cost, and keep brand terms consistent — with Zentranslate Pro.',
							'zentranslate'
						)}
					/>
				</div>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

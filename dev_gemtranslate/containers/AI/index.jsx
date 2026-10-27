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
		hint: () => __('Uses GPT models. Best quality, BYOK.', 'gemtranslate'),
	},
	{
		key: 'deepl',
		label: 'DeepL',
		hint: () => __('Specialized translation API. BYOK.', 'gemtranslate'),
	},
	{
		key: 'google',
		label: 'Google',
		hint: () => __('Cloud Translation v2 (API key auth).', 'gemtranslate'),
	},
	{
		key: 'cloud',
		label: 'GemTranslate Cloud',
		hint: () =>
			__('Hosted proxy with credit packs. Set the endpoint and license key.', 'gemtranslate'),
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
		return <LoadingBlock>{__('Loading AI providers…', 'gemtranslate')}</LoadingBlock>;

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
			setToast({ tone: 'success', message: __('AI providers saved.', 'gemtranslate') });
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
					__('%s credentials work.', 'gemtranslate'),
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
				title={__('AI Translation', 'gemtranslate')}
				description={__(
					'Connect your own AI provider keys. Translations stay on your site.',
					'gemtranslate'
				)}
				actions={
					<Button onClick={onSave} loading={save.isPending}>
						{__('Save changes', 'gemtranslate')}
					</Button>
				}
			/>

			<Card title={__('Default provider', 'gemtranslate')} className="gtrans-mb-6">
				<Field label={__("Used when 'Translate with AI' is clicked", 'gemtranslate')}>
					<Select
						value={state.default || ''}
						onChange={(e) => setState((s) => ({ ...s, default: e.target.value }))}
					>
						<option value="">{__('— Pick one —', 'gemtranslate')}</option>
						{PROVIDERS.map((p) => (
							<option key={p.key} value={p.key}>
								{p.label}
							</option>
						))}
					</Select>
				</Field>
			</Card>

			<div className="gtrans-grid gtrans-gap-6 lg:gtrans-grid-cols-3">
				{PROVIDERS.map((p) => {
					const cfg = state.providers[p.key] || {};
					return (
						<Card key={p.key} title={p.label}>
							<p className="gtrans-mb-3 gtrans-text-xs gtrans-text-gtrans-muted">{p.hint()}</p>
							<div className="gtrans-flex gtrans-flex-col gtrans-gap-3">
								<Field
									label={__('API key', 'gemtranslate')}
									hint={
										cfg.has_key
											? __('Key saved. Enter a new value to replace.', 'gemtranslate')
											: __('Required.', 'gemtranslate')
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
										label={__('Model', 'gemtranslate')}
										hint={__('Default: gpt-4o-mini', 'gemtranslate')}
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
										label={__('Use DeepL Pro endpoint', 'gemtranslate')}
										checked={!!cfg.use_pro}
										onChange={(e) => update(p.key, 'use_pro', e.target.checked)}
									/>
								)}
								{p.key === 'cloud' && (
									<Field
										label={__('Cloud endpoint', 'gemtranslate')}
										hint={__('https://your-gemtranslate-cloud.example.com', 'gemtranslate')}
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
									{__('Test credentials', 'gemtranslate')}
								</Button>
							</div>
						</Card>
					);
				})}
			</div>

			{hasFeature('translation_memory') ? (
				<Card title={__('Translation memory', 'gemtranslate')} className="gtrans-mt-6">
					{memory.isLoading ? (
						<LoadingBlock>{__('Loading memory stats…', 'gemtranslate')}</LoadingBlock>
					) : (
						<div className="gtrans-grid gtrans-grid-cols-2 gtrans-gap-4 gtrans-text-sm">
							<div>
								<div className="gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
									{__('Cached entries', 'gemtranslate')}
								</div>
								<div className="gtrans-mt-1 gtrans-text-xl gtrans-font-semibold">
									{memory.data?.entries ?? 0}
								</div>
							</div>
							<div>
								<div className="gtrans-text-xs gtrans-uppercase gtrans-text-gtrans-muted">
									{__('Reuse hits', 'gemtranslate')}
								</div>
								<div className="gtrans-mt-1 gtrans-text-xl gtrans-font-semibold">
									{memory.data?.hits ?? 0}
								</div>
							</div>
						</div>
					)}
				</Card>
			) : (
				<div className="gtrans-mt-6">
					<UpsellCard
						title={__('Translation memory & glossary', 'gemtranslate')}
						description={__(
							'Reuse past translations to cut cost, and keep brand terms consistent — with GemTranslate Pro.',
							'gemtranslate'
						)}
					/>
				</div>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

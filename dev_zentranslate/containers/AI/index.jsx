import { useEffect, useState } from 'react';

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

const PROVIDERS = [
	{ key: 'openai', label: 'OpenAI', hint: 'Uses GPT models. Best quality, BYOK.' },
	{ key: 'deepl', label: 'DeepL', hint: 'Specialized translation API. BYOK.' },
	{ key: 'google', label: 'Google', hint: 'Cloud Translation v2 (API key auth).' },
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

	if (providers.isLoading || !state) return <LoadingBlock>Loading AI providers…</LoadingBlock>;

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
			setToast({ tone: 'success', message: 'AI providers saved.' });
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

		try {
			await test.mutateAsync({ name, ...payload });
			setToast({ tone: 'success', message: `${name} credentials work.` });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title="AI Translation"
				description="Connect your own AI provider keys. Translations stay on your site."
				actions={<Button onClick={onSave} loading={save.isPending}>Save changes</Button>}
			/>

			<Card title="Default provider" className="ztrans-mb-6">
				<Field label="Used when 'Translate with AI' is clicked">
					<Select value={state.default || ''} onChange={(e) => setState((s) => ({ ...s, default: e.target.value }))}>
						<option value="">— Pick one —</option>
						{PROVIDERS.map((p) => (
							<option key={p.key} value={p.key}>{p.label}</option>
						))}
					</Select>
				</Field>
			</Card>

			<div className="ztrans-grid ztrans-gap-6 lg:ztrans-grid-cols-3">
				{PROVIDERS.map((p) => {
					const cfg = state.providers[p.key] || {};
					return (
						<Card key={p.key} title={p.label}>
							<p className="ztrans-mb-3 ztrans-text-xs ztrans-text-ztrans-muted">{p.hint}</p>
							<div className="ztrans-flex ztrans-flex-col ztrans-gap-3">
								<Field label="API key" hint={cfg.has_key ? 'Key saved. Enter a new value to replace.' : 'Required.'}>
									<TextInput
										value={cfg.api_key || ''}
										onChange={(e) => update(p.key, 'api_key', e.target.value)}
										placeholder={cfg.has_key ? cfg.api_key : 'sk-…'}
										type="password"
									/>
								</Field>
								{p.key === 'openai' && (
									<Field label="Model" hint="Default: gpt-4o-mini">
										<TextInput
											value={cfg.model || ''}
											onChange={(e) => update(p.key, 'model', e.target.value)}
											placeholder="gpt-4o-mini"
										/>
									</Field>
								)}
								{p.key === 'deepl' && (
									<Checkbox
										label="Use DeepL Pro endpoint"
										checked={!!cfg.use_pro}
										onChange={(e) => update(p.key, 'use_pro', e.target.checked)}
									/>
								)}
								<Button variant="secondary" size="sm" onClick={() => onTest(p.key)} loading={test.isPending}>
									Test credentials
								</Button>
							</div>
						</Card>
					);
				})}
			</div>

			<Card title="Translation memory" className="ztrans-mt-6">
				{memory.isLoading ? (
					<LoadingBlock>Loading memory stats…</LoadingBlock>
				) : (
					<div className="ztrans-grid ztrans-grid-cols-2 ztrans-gap-4 ztrans-text-sm">
						<div>
							<div className="ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">Cached entries</div>
							<div className="ztrans-mt-1 ztrans-text-xl ztrans-font-semibold">{memory.data?.entries ?? 0}</div>
						</div>
						<div>
							<div className="ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">Reuse hits</div>
							<div className="ztrans-mt-1 ztrans-text-xl ztrans-font-semibold">{memory.data?.hits ?? 0}</div>
						</div>
					</div>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

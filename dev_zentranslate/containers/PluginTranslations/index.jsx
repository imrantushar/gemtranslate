import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
import { Field, Select, TextInput } from '../../components/Input';
import { useDeleteTranslationPack, useGenerateTranslationPack, useTranslationPacks } from '../../hooks/useI18n';
import { useLanguages } from '../../hooks/useLanguages';
import { formatErrorMessage } from '../../lib/format';

export default function PluginTranslationsPage() {
	const packs = useTranslationPacks();
	const generate = useGenerateTranslationPack();
	const remove = useDeleteTranslationPack();
	const langs = useLanguages();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);

	const [targetLang, setTargetLang] = useState(nonDefault[0]?.code || '');
	const [locale, setLocale] = useState(nonDefault[0]?.locale || '');
	const [toast, setToast] = useState(null);

	if (langs.isLoading || packs.isLoading) return <LoadingBlock>{__('Loading…', 'zentranslate')}</LoadingBlock>;

	const onPickLang = (code) => {
		setTargetLang(code);
		const lang = nonDefault.find((l) => l.code === code);
		if (lang) setLocale(lang.locale);
	};

	const onGenerate = async () => {
		if (!targetLang || !locale) return;
		try {
			const result = await generate.mutateAsync({ target_lang: targetLang, locale });
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: written, 2: total, 3: locale. */
					__('%1$d of %2$d strings translated into %3$s.', 'zentranslate'),
					result.written,
					result.total,
					result.locale
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onDelete = async (loc) => {
		if (!window.confirm(__('Remove this translation pack?', 'zentranslate'))) return;
		try {
			await remove.mutateAsync(loc);
			setToast({ tone: 'success', message: __('Pack deleted.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const existing = Object.values(packs.data || {});

	return (
		<>
			<PageHeader
				title={__('Plugin translations', 'zentranslate')}
				description={__('Auto-generate the Zentranslate admin in any active language using your configured AI provider.', 'zentranslate')}
			/>

			<Card title={__('Generate a new pack', 'zentranslate')} className="ztrans-mb-6">
				<div className="ztrans-grid ztrans-grid-cols-1 md:ztrans-grid-cols-3 ztrans-gap-4">
					<Field label={__('Target language', 'zentranslate')}>
						<Select value={targetLang} onChange={(e) => onPickLang(e.target.value)}>
							{nonDefault.map((l) => (
								<option key={l.code} value={l.code}>{l.name} ({l.code})</option>
							))}
						</Select>
					</Field>
					<Field label={__('Locale', 'zentranslate')} hint={__('WP locale like es_ES, fr_FR.', 'zentranslate')}>
						<TextInput value={locale} onChange={(e) => setLocale(e.target.value)} />
					</Field>
					<div className="ztrans-flex ztrans-items-end">
						<Button onClick={onGenerate} loading={generate.isPending} disabled={!targetLang || !locale}>
							{__('Generate with AI', 'zentranslate')}
						</Button>
					</div>
				</div>
				<p className="ztrans-mt-3 ztrans-text-xs ztrans-text-ztrans-muted">
					{__('Reads languages/zentranslate.pot, translates each string in batches through the default AI provider, and writes PO + MO + JSON to languages/.', 'zentranslate')}
				</p>
			</Card>

			<Card padded={false} title={__('Existing packs', 'zentranslate')}>
				{existing.length === 0 ? (
					<p className="ztrans-px-5 ztrans-py-8 ztrans-text-center ztrans-text-sm ztrans-text-ztrans-muted">
						{__('No translation packs yet.', 'zentranslate')}
					</p>
				) : (
					<table className="ztrans-w-full ztrans-text-sm">
						<thead className="ztrans-bg-ztrans-bg ztrans-text-left ztrans-text-xs ztrans-uppercase ztrans-text-ztrans-muted">
							<tr>
								<th className="ztrans-px-4 ztrans-py-3">{__('Locale', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('PO', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('MO', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3">{__('JSON files', 'zentranslate')}</th>
								<th className="ztrans-px-4 ztrans-py-3" />
							</tr>
						</thead>
						<tbody>
							{existing.map((p) => (
								<tr key={p.locale} className="ztrans-border-t ztrans-border-ztrans-border">
									<td className="ztrans-px-4 ztrans-py-3"><code>{p.locale}</code></td>
									<td className="ztrans-px-4 ztrans-py-3">
										{p.po ? <StatusPill tone="translated">✓</StatusPill> : <StatusPill tone="none">—</StatusPill>}
									</td>
									<td className="ztrans-px-4 ztrans-py-3">
										{p.mo ? <StatusPill tone="translated">✓</StatusPill> : <StatusPill tone="none">—</StatusPill>}
									</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-ztrans-muted">{p.json}</td>
									<td className="ztrans-px-4 ztrans-py-3 ztrans-text-right">
										<Button variant="ghost" size="sm" onClick={() => onDelete(p.locale)}>
											{__('Delete', 'zentranslate')}
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

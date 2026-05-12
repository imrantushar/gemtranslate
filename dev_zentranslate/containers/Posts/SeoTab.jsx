import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import { Field, TextInput, TextArea } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { usePostSeo, useSavePostSeo } from '../../hooks/useSeo';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

const FIELDS = [
	{ key: 'meta_title', label: () => __('Meta title', 'zentranslate') },
	{ key: 'meta_desc', label: () => __('Meta description', 'zentranslate') },
	{ key: 'og_title', label: () => __('OpenGraph title', 'zentranslate') },
	{ key: 'og_desc', label: () => __('OpenGraph description', 'zentranslate') },
	{ key: 'canonical_override', label: () => __('Canonical override', 'zentranslate') },
];

export default function SeoTab({ postId, sourceLang, targetLang, onToast }) {
	const seo = usePostSeo(postId, targetLang);
	const save = useSavePostSeo();
	const ai = useTranslateWithAI();
	const [form, setForm] = useState({});

	useEffect(() => {
		if (!seo.data) return;
		setForm({
			meta_title: seo.data.meta_title || '',
			meta_desc: seo.data.meta_desc || '',
			og_title: seo.data.og_title || '',
			og_desc: seo.data.og_desc || '',
			canonical_override: seo.data.canonical_override || '',
		});
	}, [seo.data, targetLang]);

	const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

	const submit = async (e) => {
		e.preventDefault();
		try {
			await save.mutateAsync({ postId, lang: targetLang, payload: form });
			onToast({ tone: 'success', message: __('SEO meta saved.', 'zentranslate') });
		} catch (err) {
			onToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFill = async (key) => {
		const original = (form[key] || '').trim();
		const source = original || (key === 'meta_title' || key === 'og_title' ? __('(no source)', 'zentranslate') : '');
		if (!source) return;
		try {
			const res = await ai.mutateAsync({
				text: source,
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: false,
				use_memory: true,
			});
			setForm((f) => ({ ...f, [key]: res.translations }));
		} catch (err) {
			onToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	if (seo.isLoading) return <LoadingBlock>{__('Loading SEO meta…', 'zentranslate')}</LoadingBlock>;

	return (
		<Card title={__('SEO meta for this translation', 'zentranslate')}>
			<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-3">
				{FIELDS.map((f) => (
					<div key={f.key} className="ztrans-flex ztrans-items-end ztrans-gap-2">
						<div className="ztrans-flex-1">
							<Field label={f.label()}>
								{f.key.includes('desc') ? (
									<TextArea rows={3} value={form[f.key] || ''} onChange={set(f.key)} />
								) : (
									<TextInput value={form[f.key] || ''} onChange={set(f.key)} />
								)}
							</Field>
						</div>
						<Button variant="ghost" size="sm" onClick={() => aiFill(f.key)}>
							{__('AI', 'zentranslate')}
						</Button>
					</div>
				))}
				<div className="ztrans-flex ztrans-justify-end">
					<Button type="submit" loading={save.isPending}>{__('Save SEO meta', 'zentranslate')}</Button>
				</div>
			</form>
		</Card>
	);
}

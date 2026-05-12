import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, TextInput, TextArea } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { usePostMetaFields, useSavePostMeta } from '../../hooks/usePostMeta';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

export default function MetaTab({ postId, sourceLang, targetLang }) {
	const data = usePostMetaFields(postId, targetLang);
	const save = useSavePostMeta();
	const ai = useTranslateWithAI();
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!data.data) return;
		const init = {};
		(data.data || []).forEach((f) => { init[f.key] = f.translation; });
		setDrafts(init);
	}, [data.data, targetLang]);

	if (data.isLoading) return <LoadingBlock>{__('Loading meta fields…', 'zentranslate')}</LoadingBlock>;

	if (!data.data || data.data.length === 0) {
		return (
			<Card>
				<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
					{__('This post has no translatable custom fields. ACF fields and any non-internal postmeta appear here automatically.', 'zentranslate')}
				</p>
			</Card>
		);
	}

	const set = (key, value) => setDrafts((d) => ({ ...d, [key]: value }));

	const submit = async (e) => {
		e.preventDefault();
		const fields = Object.entries(drafts).map(([key, value]) => ({ key, value }));
		try {
			await save.mutateAsync({ postId, lang: targetLang, fields });
			setToast({ tone: 'success', message: __('Meta fields saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFill = async (key, source) => {
		if (!source) return;
		try {
			const res = await ai.mutateAsync({
				text: source,
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: false,
				use_memory: true,
			});
			set(key, res.translations);
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<Card title={__('Custom fields & ACF', 'zentranslate')}>
				<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-3">
					{data.data.map((f) => (
						<div key={f.key} className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-3">
							<Field label={`${f.label} (source)`} hint={<code>{f.key}</code>}>
								{f.source.length > 120 ? (
									<TextArea rows={3} value={f.source} readOnly />
								) : (
									<TextInput value={f.source} readOnly />
								)}
							</Field>
							<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
								<div className="ztrans-flex-1">
									<Field label={__('Translation', 'zentranslate')}>
										{f.source.length > 120 ? (
											<TextArea rows={3} value={drafts[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
										) : (
											<TextInput value={drafts[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
										)}
									</Field>
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFill(f.key, f.source)}>
									{__('AI', 'zentranslate')}
								</Button>
							</div>
						</div>
					))}
					<div className="ztrans-mt-2 ztrans-flex ztrans-justify-end">
						<Button type="submit" loading={save.isPending}>{__('Save fields', 'zentranslate')}</Button>
					</div>
				</form>
			</Card>
			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

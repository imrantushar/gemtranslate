import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, TextInput, TextArea } from '../../components/Input';
import { FormSkeleton } from '../../components/Skeleton';
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

	if (data.isLoading) return <FormSkeleton />;

	if (!data.data || data.data.length === 0) {
		return (
			<Card>
				<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
					{__('This post has no translatable custom fields. ACF fields and any non-internal postmeta appear here automatically.', 'gemtranslate')}
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
			setToast({ tone: 'success', message: __('Meta fields saved.', 'gemtranslate') });
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
			<Card title={__('Custom fields & ACF', 'gemtranslate')}>
				<form onSubmit={submit} className="gtrans-flex gtrans-flex-col gtrans-gap-3">
					{data.data.map((f) => (
						<div key={f.key} className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-3">
							<Field label={`${f.label} (source)`} hint={<code>{f.key}</code>}>
								{f.source.length > 120 ? (
									<TextArea rows={3} value={f.source} readOnly />
								) : (
									<TextInput value={f.source} readOnly />
								)}
							</Field>
							<div className="gtrans-flex gtrans-items-end gtrans-gap-2">
								<div className="gtrans-flex-1">
									<Field label={__('Translation', 'gemtranslate')}>
										{f.source.length > 120 ? (
											<TextArea rows={3} value={drafts[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
										) : (
											<TextInput value={drafts[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
										)}
									</Field>
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFill(f.key, f.source)}>
									{__('AI', 'gemtranslate')}
								</Button>
							</div>
						</div>
					))}
					<div className="gtrans-mt-2 gtrans-flex gtrans-justify-end">
						<Button type="submit" loading={save.isPending}>{__('Save fields', 'gemtranslate')}</Button>
					</div>
				</form>
			</Card>
			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

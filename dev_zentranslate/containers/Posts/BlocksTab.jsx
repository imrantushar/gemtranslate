import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, TextArea, TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { usePostBlocks, useSavePostBlocks } from '../../hooks/usePostBlocks';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

export default function BlocksTab({ postId, sourceLang, targetLang }) {
	const data = usePostBlocks(postId, targetLang);
	const save = useSavePostBlocks();
	const ai = useTranslateWithAI();
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!data.data) return;
		const init = {};
		(data.data.fields || []).forEach((f) => { init[f.path] = f.translation; });
		setDrafts(init);
	}, [data.data, targetLang]);

	if (data.isLoading) return <LoadingBlock>{__('Loading blocks…', 'zentranslate')}</LoadingBlock>;

	if (!data.data?.is_block_content) {
		return (
			<Card>
				<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
					{__('This post is not block-based. Use the Content tab for classic HTML editing.', 'zentranslate')}
				</p>
			</Card>
		);
	}

	const set = (path, value) => setDrafts((d) => ({ ...d, [path]: value }));

	const submit = async (e) => {
		e.preventDefault();
		const fields = Object.entries(drafts).map(([path, value]) => ({ path, value }));
		try {
			await save.mutateAsync({ postId, lang: targetLang, fields });
			setToast({ tone: 'success', message: __('Block translation saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFillAll = async () => {
		const sources = data.data.fields.map((f) => f.source);
		try {
			const res = await ai.mutateAsync({
				text: sources,
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: true,
				use_memory: true,
			});
			const next = { ...drafts };
			data.data.fields.forEach((f, i) => {
				next[f.path] = res.translations[i] || next[f.path] || '';
			});
			setDrafts(next);
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFillOne = async (path, source) => {
		try {
			const res = await ai.mutateAsync({
				text: source,
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: true,
				use_memory: true,
			});
			set(path, res.translations);
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<Card
				title={__('Block-by-block translation', 'zentranslate')}
				action={
					<Button variant="secondary" size="sm" onClick={aiFillAll} loading={ai.isPending}>
						{__('Translate all blocks with AI', 'zentranslate')}
					</Button>
				}
			>
				<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-4">
					{(data.data.fields || []).map((f) => (
						<div key={f.path} className="ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-p-3">
							<div className="ztrans-mb-2 ztrans-flex ztrans-items-center ztrans-justify-between ztrans-text-xs ztrans-text-ztrans-muted">
								<div>
									<code>{f.block}</code>
									{f.kind === 'attr' && (
										<span className="ztrans-ml-2">{__('attribute', 'zentranslate')}: <code>{f.attr}</code></span>
									)}
								</div>
								<Button variant="ghost" size="sm" onClick={() => aiFillOne(f.path, f.source)}>
									{__('AI', 'zentranslate')}
								</Button>
							</div>
							<div className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-3">
								<Field label={__('Source', 'zentranslate')}>
									{f.kind === 'attr' ? (
										<TextInput value={f.source} readOnly />
									) : (
										<TextArea rows={5} value={f.source} readOnly />
									)}
								</Field>
								<Field label={__('Translation', 'zentranslate')}>
									{f.kind === 'attr' ? (
										<TextInput value={drafts[f.path] ?? ''} onChange={(e) => set(f.path, e.target.value)} />
									) : (
										<TextArea rows={5} value={drafts[f.path] ?? ''} onChange={(e) => set(f.path, e.target.value)} />
									)}
								</Field>
							</div>
						</div>
					))}
					<div className="ztrans-mt-2 ztrans-flex ztrans-justify-end">
						<Button type="submit" loading={save.isPending}>{__('Save blocks', 'zentranslate')}</Button>
					</div>
				</form>
			</Card>
			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

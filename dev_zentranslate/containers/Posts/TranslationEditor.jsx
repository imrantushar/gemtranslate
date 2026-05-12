import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { Field, TextInput, TextArea, Select } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { usePostTranslations, useSaveTranslation } from '../../hooks/usePosts';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

export default function TranslationEditor() {
	const { id } = useParams();
	const data = usePostTranslations(id);
	const save = useSaveTranslation();
	const aiTranslate = useTranslateWithAI();
	const [selectedLang, setSelectedLang] = useState('');
	const [form, setForm] = useState({ title: '', content: '', excerpt: '', slug: '', status: 'publish' });
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!data.data) return;
		const langs = data.data.translations || [];
		if (langs.length === 0) return;
		const target = selectedLang || langs[0].language.code;
		setSelectedLang(target);
		const row = langs.find((l) => l.language.code === target);
		setForm({
			title: row?.translation?.title ?? '',
			content: row?.translation?.content ?? '',
			excerpt: row?.translation?.excerpt ?? '',
			slug: row?.translation?.slug ?? '',
			status: row?.translation?.status ?? 'publish',
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.data, selectedLang]);

	if (data.isLoading) return <LoadingBlock>Loading translation editor…</LoadingBlock>;
	if (data.error) return <p className="ztrans-text-red-600">{formatErrorMessage(data.error)}</p>;
	if (!data.data) return null;

	const { post, translations, default_lang: defaultLang } = data.data;
	const targetLangs = translations || [];
	const targetRow = targetLangs.find((l) => l.language.code === selectedLang);

	const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

	const submit = async (e) => {
		e.preventDefault();
		try {
			await save.mutateAsync({ postId: post.id, lang: selectedLang, payload: form });
			setToast({ tone: 'success', message: 'Translation saved.' });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFill = async (field, sourceText) => {
		try {
			const result = await aiTranslate.mutateAsync({
				text: sourceText,
				source_lang: defaultLang,
				target_lang: selectedLang,
				preserve_html: field === 'content',
				use_memory: true,
			});
			setForm((f) => ({ ...f, [field]: result.translations }));
			setToast({ tone: 'success', message: `AI filled ${field}.` });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFillAll = async () => {
		try {
			const res = await aiTranslate.mutateAsync({
				text: [post.title, post.excerpt || '', post.content || ''],
				source_lang: defaultLang,
				target_lang: selectedLang,
				preserve_html: true,
				use_memory: true,
			});
			setForm((f) => ({
				...f,
				title: res.translations[0] || f.title,
				excerpt: res.translations[1] || f.excerpt,
				content: res.translations[2] || f.content,
			}));
			setToast({ tone: 'success', message: 'AI translation applied to all fields.' });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={`Translate: ${post.title}`}
				description={`Source language: ${defaultLang}. Pick a target language and edit the translation.`}
				actions={
					<Link to="/posts" className="ztrans-text-sm ztrans-text-ztrans-primary ztrans-no-underline">
						← Back to posts
					</Link>
				}
			/>

			{targetLangs.length === 0 ? (
				<Card>
					<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
						Add at least one non-default language to start translating posts.
					</p>
				</Card>
			) : (
				<>
					<div className="ztrans-mb-4 ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-2">
						{targetLangs.map((t) => (
							<button
								key={t.language.code}
								onClick={() => setSelectedLang(t.language.code)}
								className={`ztrans-bare ztrans-rounded-md ztrans-px-3 ztrans-py-1.5 ztrans-text-sm ${
									selectedLang === t.language.code
										? 'ztrans-bg-ztrans-primary ztrans-text-white'
										: 'ztrans-bg-white ztrans-border ztrans-border-ztrans-border ztrans-text-gray-700'
								}`}
							>
								{t.language.name}
								{t.translation && (
									<span className="ztrans-ml-2 ztrans-text-xs ztrans-opacity-80">
										({t.translation.status})
									</span>
								)}
							</button>
						))}
						<Button variant="secondary" size="sm" onClick={aiFillAll} loading={aiTranslate.isPending}>
							Translate all with AI
						</Button>
					</div>

					<div className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-6">
						<Card title={`Source — ${defaultLang}`}>
							<div className="ztrans-flex ztrans-flex-col ztrans-gap-3">
								<Field label="Title">
									<TextInput value={post.title || ''} readOnly />
								</Field>
								<Field label="Slug">
									<TextInput value={post.slug || ''} readOnly />
								</Field>
								<Field label="Excerpt">
									<TextArea rows={3} value={post.excerpt || ''} readOnly />
								</Field>
								<Field label="Content">
									<TextArea rows={14} value={post.content || ''} readOnly />
								</Field>
							</div>
						</Card>

						<Card
							title={`Translation — ${selectedLang}`}
							action={
								targetRow?.translation && (
									<StatusPill tone={targetRow.translation.status === 'publish' ? 'translated' : 'pending'}>
										{targetRow.translation.status}
									</StatusPill>
								)
							}
						>
							<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-3">
								<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
									<div className="ztrans-flex-1">
										<Field label="Title">
											<TextInput value={form.title} onChange={set('title')} />
										</Field>
									</div>
									<Button variant="ghost" size="sm" onClick={() => aiFill('title', post.title)}>
										AI
									</Button>
								</div>
								<Field label="Slug" hint="Used for SEO-friendly URLs.">
									<TextInput value={form.slug} onChange={set('slug')} />
								</Field>
								<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
									<div className="ztrans-flex-1">
										<Field label="Excerpt">
											<TextArea rows={3} value={form.excerpt} onChange={set('excerpt')} />
										</Field>
									</div>
									<Button variant="ghost" size="sm" onClick={() => aiFill('excerpt', post.excerpt || '')}>
										AI
									</Button>
								</div>
								<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
									<div className="ztrans-flex-1">
										<Field label="Content">
											<TextArea rows={14} value={form.content} onChange={set('content')} />
										</Field>
									</div>
									<Button variant="ghost" size="sm" onClick={() => aiFill('content', post.content || '')}>
										AI
									</Button>
								</div>
								<Field label="Status">
									<Select value={form.status} onChange={set('status')}>
										<option value="draft">Draft</option>
										<option value="publish">Published</option>
									</Select>
								</Field>
								<div className="ztrans-mt-2 ztrans-flex ztrans-justify-end">
									<Button type="submit" loading={save.isPending}>Save translation</Button>
								</div>
							</form>
						</Card>
					</div>
				</>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

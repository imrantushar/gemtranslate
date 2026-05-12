import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

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
import SeoTab from './SeoTab';
import MetaTab from './MetaTab';
import BlocksTab from './BlocksTab';
import HistoryTab from './HistoryTab';

export default function TranslationEditor() {
	const { id } = useParams();
	const data = usePostTranslations(id);
	const save = useSaveTranslation();
	const aiTranslate = useTranslateWithAI();
	const [selectedLang, setSelectedLang] = useState('');
	const [tab, setTab] = useState('content');
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

	if (data.isLoading) return <LoadingBlock>{__('Loading translation editor…', 'zentranslate')}</LoadingBlock>;
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
			setToast({ tone: 'success', message: __('Translation saved.', 'zentranslate') });
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
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: %s: field name like title, excerpt, content. */
					__('AI filled %s.', 'zentranslate'),
					field
				),
			});
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
			setToast({ tone: 'success', message: __('AI translation applied to all fields.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={sprintf(
					/* translators: %s: post title. */
					__('Translate: %s', 'zentranslate'),
					post.title
				)}
				description={sprintf(
					/* translators: %s: source language code. */
					__('Source language: %s. Pick a target language and edit the translation.', 'zentranslate'),
					defaultLang
				)}
				actions={
					<Link to="/posts" className="ztrans-text-sm ztrans-text-ztrans-primary ztrans-no-underline">
						{__('← Back to posts', 'zentranslate')}
					</Link>
				}
			/>

			{targetLangs.length === 0 ? (
				<Card>
					<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
						{__('Add at least one non-default language to start translating posts.', 'zentranslate')}
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
							{__('Translate all with AI', 'zentranslate')}
						</Button>
					</div>

					<div className="ztrans-mb-4 ztrans-flex ztrans-border-b ztrans-border-ztrans-border">
						{[
							{ key: 'content', label: __('Content', 'zentranslate') },
							{ key: 'blocks', label: __('Blocks', 'zentranslate') },
							{ key: 'meta', label: __('Fields', 'zentranslate') },
							{ key: 'seo', label: __('SEO', 'zentranslate') },
							{ key: 'history', label: __('History', 'zentranslate') },
						].map((t) => (
							<button
								key={t.key}
								type="button"
								onClick={() => setTab(t.key)}
								className={`ztrans-bare ztrans-px-4 ztrans-py-2 ztrans-text-sm ztrans-border-b-2 ${
									tab === t.key
										? 'ztrans-border-ztrans-primary ztrans-text-ztrans-primary ztrans-font-semibold'
										: 'ztrans-border-transparent ztrans-text-gray-600 hover:ztrans-text-gray-900'
								}`}
							>
								{t.label}
							</button>
						))}
					</div>

					{tab === 'seo' ? (
						<SeoTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} onToast={setToast} />
					) : tab === 'meta' ? (
						<MetaTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} />
					) : tab === 'blocks' ? (
						<BlocksTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} />
					) : tab === 'history' ? (
						<HistoryTab postId={post.id} targetLang={selectedLang} />
					) : (
					<div className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-6">
						<Card title={sprintf(/* translators: %s: language code. */ __('Source — %s', 'zentranslate'), defaultLang)}>
							<div className="ztrans-flex ztrans-flex-col ztrans-gap-3">
								<Field label={__('Title', 'zentranslate')}>
									<TextInput value={post.title || ''} readOnly />
								</Field>
								<Field label={__('Slug', 'zentranslate')}>
									<TextInput value={post.slug || ''} readOnly />
								</Field>
								<Field label={__('Excerpt', 'zentranslate')}>
									<TextArea rows={3} value={post.excerpt || ''} readOnly />
								</Field>
								<Field label={__('Content', 'zentranslate')}>
									<TextArea rows={14} value={post.content || ''} readOnly />
								</Field>
							</div>
						</Card>

						<Card
							title={sprintf(/* translators: %s: language code. */ __('Translation — %s', 'zentranslate'), selectedLang)}
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
										<Field label={__('Title', 'zentranslate')}>
											<TextInput value={form.title} onChange={set('title')} />
										</Field>
									</div>
									<Button variant="ghost" size="sm" onClick={() => aiFill('title', post.title)}>
										{__('AI', 'zentranslate')}
									</Button>
								</div>
								<Field label={__('Slug', 'zentranslate')} hint={__('Used for SEO-friendly URLs.', 'zentranslate')}>
									<TextInput value={form.slug} onChange={set('slug')} />
								</Field>
								<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
									<div className="ztrans-flex-1">
										<Field label={__('Excerpt', 'zentranslate')}>
											<TextArea rows={3} value={form.excerpt} onChange={set('excerpt')} />
										</Field>
									</div>
									<Button variant="ghost" size="sm" onClick={() => aiFill('excerpt', post.excerpt || '')}>
										{__('AI', 'zentranslate')}
									</Button>
								</div>
								<div className="ztrans-flex ztrans-items-end ztrans-gap-2">
									<div className="ztrans-flex-1">
										<Field label={__('Content', 'zentranslate')}>
											<TextArea rows={14} value={form.content} onChange={set('content')} />
										</Field>
									</div>
									<Button variant="ghost" size="sm" onClick={() => aiFill('content', post.content || '')}>
										{__('AI', 'zentranslate')}
									</Button>
								</div>
								<Field label={__('Status', 'zentranslate')}>
									<Select value={form.status} onChange={set('status')}>
										<option value="draft">{__('Draft', 'zentranslate')}</option>
										<option value="publish">{__('Published', 'zentranslate')}</option>
									</Select>
								</Field>
								<div className="ztrans-mt-2 ztrans-flex ztrans-justify-end">
									<Button type="submit" loading={save.isPending}>
										{__('Save translation', 'zentranslate')}
									</Button>
								</div>
							</form>
						</Card>
					</div>
					)}
				</>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

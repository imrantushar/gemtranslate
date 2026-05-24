import { useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, TextArea, TextInput } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { usePostFields, useSavePostFields } from '../../hooks/usePostFields';
import { useTranslateWithAI } from '../../hooks/useAI';
import { formatErrorMessage } from '../../lib/format';

/**
 * String-only editor. Each row shows the translator-facing TOKENISED text:
 * block wrappers stripped, inline tags (`<strong>`, `<a>`, …) replaced by
 * numbered placeholders `{1}`, `{2}`, … A small legend below each row maps
 * each `{N}` back to the original tag so the translator knows what they
 * represent.
 *
 * Layout edits to the source self-heal: the wrapper template + token map are
 * recomputed from live source on every render, so attribute/whitespace drift
 * doesn't break translation bindings.
 */
export default function FieldsTab({ postId, sourceLang, targetLang, country = '' }) {
	const data = usePostFields(postId, targetLang, country);
	const save = useSavePostFields();
	const ai = useTranslateWithAI();
	const [drafts, setDrafts] = useState({});
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (!data.data) return;
		const init = {};
		(data.data.fields || []).forEach((f) => { init[f.path] = f.translation; });
		setDrafts(init);
	}, [data.data, targetLang, country]);

	if (data.isLoading) return <LoadingBlock>{__('Loading fields…', 'zentranslate')}</LoadingBlock>;
	if (!data.data) return null;

	const set = (path, value) => setDrafts((d) => ({ ...d, [path]: value }));

	const submit = async (e) => {
		e.preventDefault();
		const fields = (data.data.fields || []).map((f) => ({
			path: f.path,
			source: f.source,
			value: drafts[f.path] ?? '',
		}));
		try {
			await save.mutateAsync({ postId, lang: targetLang, country, fields });
			setToast({ tone: 'success', message: __('Translations saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const aiFillAll = async () => {
		const sources = (data.data.fields || []).map((f) => f.source);
		try {
			const res = await ai.mutateAsync({
				text: sources,
				source_lang: sourceLang,
				target_lang: targetLang,
				preserve_html: false,
				use_memory: true,
			});
			const next = { ...drafts };
			(data.data.fields || []).forEach((f, i) => {
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
				preserve_html: false,
				use_memory: true,
			});
			set(path, res.translations);
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const labelFor = (f) => {
		if (f.path === 'title') return __('Title', 'zentranslate');
		if (f.path === 'excerpt') return __('Excerpt', 'zentranslate');
		if (f.path === 'body') return __('Body (classic)', 'zentranslate');
		return f.block + (f.kind === 'attr' ? ` · ${f.attr}` : '');
	};

	return (
		<>
			<Card
				title={__('String-only translation', 'zentranslate')}
				action={
					<Button variant="secondary" size="sm" onClick={aiFillAll} loading={ai.isPending}>
						{__('Translate all with AI', 'zentranslate')}
					</Button>
				}
			>
				<p className="ztrans-mb-3 ztrans-text-xs ztrans-text-ztrans-muted">
					{__(
						'Translate text only — block wrappers and inline tags are protected. Use {1} {2} placeholders for bold/links/etc; the legend under each field shows what each token means.',
						'zentranslate'
					)}
				</p>
				<form onSubmit={submit} className="ztrans-flex ztrans-flex-col ztrans-gap-4">
					{(data.data.fields || []).map((f) => (
						<FieldRow
							key={f.path}
							field={f}
							label={labelFor(f)}
							draft={drafts[f.path] ?? ''}
							onChange={(v) => set(f.path, v)}
							onAI={() => aiFillOne(f.path, f.source)}
							aiBusy={ai.isPending}
						/>
					))}
					<div className="ztrans-mt-2 ztrans-flex ztrans-justify-end">
						<Button type="submit" loading={save.isPending}>{__('Save translations', 'zentranslate')}</Button>
					</div>
				</form>
			</Card>
			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

/** One row: source on the left, translation on the right, legend underneath. */
function FieldRow({ field, label, draft, onChange, onAI, aiBusy }) {
	const tokens = field.tokens || {};
	const tokenNumbers = Object.keys(tokens);
	const sourceTokenCount = countPlaceholders(field.source);
	const draftTokenCount = countPlaceholders(draft);
	const isSingleLine = field.kind === 'attr' || field.path === 'title' || field.path === 'excerpt';

	const mismatch = draft && draftTokenCount !== sourceTokenCount;

	return (
		<div className="ztrans-rounded-md ztrans-border ztrans-border-ztrans-border ztrans-p-3">
			<div className="ztrans-mb-2 ztrans-flex ztrans-items-center ztrans-justify-between ztrans-text-xs ztrans-text-ztrans-muted">
				<code>{label}</code>
				<Button variant="ghost" size="sm" onClick={onAI} loading={aiBusy}>
					{__('AI', 'zentranslate')}
				</Button>
			</div>
			<div className="ztrans-grid ztrans-grid-cols-1 lg:ztrans-grid-cols-2 ztrans-gap-3">
				<Field label={__('Source', 'zentranslate')}>
					{isSingleLine ? (
						<TextInput value={field.source} readOnly />
					) : (
						<TextArea rows={5} value={field.source} readOnly />
					)}
				</Field>
				<Field label={__('Translation', 'zentranslate')}>
					{isSingleLine ? (
						<TextInput value={draft} onChange={(e) => onChange(e.target.value)} />
					) : (
						<TextArea rows={5} value={draft} onChange={(e) => onChange(e.target.value)} />
					)}
				</Field>
			</div>
			{tokenNumbers.length > 0 && (
				<div className="ztrans-mt-2 ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-1 ztrans-text-xs ztrans-text-ztrans-muted">
					<span className="ztrans-mr-1">{__('Tokens:', 'zentranslate')}</span>
					{tokenNumbers.map((n) => (
						<TokenChip key={n} number={n} html={tokens[n]} />
					))}
					{mismatch && (
						<span className="ztrans-ml-2 ztrans-rounded ztrans-bg-amber-100 ztrans-px-2 ztrans-py-0.5 ztrans-text-amber-800">
							{sprintf(
								/* translators: 1: token count in source, 2: token count in translation */
								__('Source has %1$s tokens; translation has %2$s.', 'zentranslate'),
								sourceTokenCount,
								draftTokenCount
							)}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

function TokenChip({ number, html }) {
	const label = useMemo(() => describeToken(html), [html]);
	return (
		<span
			title={html}
			className="ztrans-inline-flex ztrans-items-center ztrans-gap-1 ztrans-rounded ztrans-bg-gray-100 ztrans-px-1.5 ztrans-py-0.5 ztrans-text-gray-700"
		>
			<code className="ztrans-text-[11px]">{`{${number}}`}</code>
			<span className="ztrans-text-[11px]">= {label}</span>
		</span>
	);
}

function describeToken(html) {
	const m = String(html).match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/);
	if (!m) return html;
	const isClose = m[1] === '/';
	const tag = m[2].toLowerCase();
	const friendly = {
		strong: __('bold', 'zentranslate'),
		b: __('bold', 'zentranslate'),
		em: __('italic', 'zentranslate'),
		i: __('italic', 'zentranslate'),
		u: __('underline', 'zentranslate'),
		s: __('strikethrough', 'zentranslate'),
		code: __('code', 'zentranslate'),
		mark: __('highlight', 'zentranslate'),
		sup: __('superscript', 'zentranslate'),
		sub: __('subscript', 'zentranslate'),
		small: __('small', 'zentranslate'),
		a: __('link', 'zentranslate'),
		br: __('line break', 'zentranslate'),
		span: __('span', 'zentranslate'),
		img: __('image', 'zentranslate'),
		cite: __('cite', 'zentranslate'),
		kbd: __('keyboard', 'zentranslate'),
		q: __('quote', 'zentranslate'),
	}[tag] || tag;
	if (tag === 'br' || tag === 'img') return friendly;
	return isClose ? `/${friendly}` : friendly;
}

function countPlaceholders(s) {
	const m = String(s || '').match(/\{\d+\}/g);
	return m ? m.length : 0;
}

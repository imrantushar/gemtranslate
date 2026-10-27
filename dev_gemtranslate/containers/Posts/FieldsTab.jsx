import { useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, TextArea, TextInput } from '../../components/Input';
import { FormSkeleton } from '../../components/Skeleton';
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

	if (data.isLoading) return <FormSkeleton />;
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
			setToast({ tone: 'success', message: __('Translations saved.', 'gemtranslate') });
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
		if (f.path === 'title') return __('Title', 'gemtranslate');
		if (f.path === 'excerpt') return __('Excerpt', 'gemtranslate');
		if (f.path === 'body') return __('Body (classic)', 'gemtranslate');
		return f.block + (f.kind === 'attr' ? ` · ${f.attr}` : '');
	};

	return (
		<>
			<Card
				title={__('String-only translation', 'gemtranslate')}
				action={
					<Button variant="secondary" size="sm" onClick={aiFillAll} loading={ai.isPending}>
						{__('Translate all with AI', 'gemtranslate')}
					</Button>
				}
			>
				<p className="gtrans-mb-3 gtrans-text-xs gtrans-text-muted">
					{__(
						'Translate text only — block wrappers and inline tags are protected. Use {1} {2} placeholders for bold/links/etc; the legend under each field shows what each token means.',
						'gemtranslate'
					)}
				</p>
				<form onSubmit={submit} className="gtrans-flex gtrans-flex-col gtrans-gap-4">
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
					<div className="gtrans-mt-2 gtrans-flex gtrans-justify-end">
						<Button type="submit" loading={save.isPending}>{__('Save translations', 'gemtranslate')}</Button>
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
		<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-p-3">
			<div className="gtrans-mb-2 gtrans-flex gtrans-items-center gtrans-justify-between gtrans-text-xs gtrans-text-muted">
				<code>{label}</code>
				<Button variant="ghost" size="sm" onClick={onAI} loading={aiBusy}>
					{__('AI', 'gemtranslate')}
				</Button>
			</div>
			<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-3">
				<Field label={__('Source', 'gemtranslate')}>
					{isSingleLine ? (
						<TextInput value={field.source} readOnly />
					) : (
						<TextArea rows={5} value={field.source} readOnly />
					)}
				</Field>
				<Field label={__('Translation', 'gemtranslate')}>
					{isSingleLine ? (
						<TextInput value={draft} onChange={(e) => onChange(e.target.value)} />
					) : (
						<TextArea rows={5} value={draft} onChange={(e) => onChange(e.target.value)} />
					)}
				</Field>
			</div>
			{tokenNumbers.length > 0 && (
				<div className="gtrans-mt-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1 gtrans-text-xs gtrans-text-muted">
					<span className="gtrans-mr-1">{__('Tokens:', 'gemtranslate')}</span>
					{tokenNumbers.map((n) => (
						<TokenChip key={n} number={n} html={tokens[n]} />
					))}
					{mismatch && (
						<span className="gtrans-ml-2 gtrans-rounded gtrans-bg-amber-100 gtrans-px-2 gtrans-py-0.5 gtrans-text-amber-800">
							{sprintf(
								/* translators: 1: token count in source, 2: token count in translation */
								__('Source has %1$s tokens; translation has %2$s.', 'gemtranslate'),
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
			className="gtrans-inline-flex gtrans-items-center gtrans-gap-1 gtrans-rounded gtrans-bg-body gtrans-px-1.5 gtrans-py-0.5 gtrans-text-label"
		>
			<code className="gtrans-text-[11px]">{`{${number}}`}</code>
			<span className="gtrans-text-[11px]">= {label}</span>
		</span>
	);
}

function describeToken(html) {
	const m = String(html).match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/);
	if (!m) return html;
	const isClose = m[1] === '/';
	const tag = m[2].toLowerCase();
	const friendly = {
		strong: __('bold', 'gemtranslate'),
		b: __('bold', 'gemtranslate'),
		em: __('italic', 'gemtranslate'),
		i: __('italic', 'gemtranslate'),
		u: __('underline', 'gemtranslate'),
		s: __('strikethrough', 'gemtranslate'),
		code: __('code', 'gemtranslate'),
		mark: __('highlight', 'gemtranslate'),
		sup: __('superscript', 'gemtranslate'),
		sub: __('subscript', 'gemtranslate'),
		small: __('small', 'gemtranslate'),
		a: __('link', 'gemtranslate'),
		br: __('line break', 'gemtranslate'),
		span: __('span', 'gemtranslate'),
		img: __('image', 'gemtranslate'),
		cite: __('cite', 'gemtranslate'),
		kbd: __('keyboard', 'gemtranslate'),
		q: __('quote', 'gemtranslate'),
	}[tag] || tag;
	if (tag === 'br' || tag === 'img') return friendly;
	return isClose ? `/${friendly}` : friendly;
}

function countPlaceholders(s) {
	const m = String(s || '').match(/\{\d+\}/g);
	return m ? m.length : 0;
}

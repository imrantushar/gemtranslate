import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import { Field, TextInput, TextArea } from '../../components/Input';
import { FormSkeleton } from '../../components/Skeleton';
import { usePostSeo, useSavePostSeo } from '../../hooks/useSeo';
import { formatErrorMessage } from '../../lib/format';

const FIELDS = [
	{ key: 'meta_title', label: () => __('Meta title', 'gemtranslate') },
	{ key: 'meta_desc', label: () => __('Meta description', 'gemtranslate') },
	{ key: 'og_title', label: () => __('OpenGraph title', 'gemtranslate') },
	{ key: 'og_desc', label: () => __('OpenGraph description', 'gemtranslate') },
	{ key: 'canonical_override', label: () => __('Canonical override', 'gemtranslate') },
];

export default function SeoTab({ postId, targetLang, onToast }) {
	const seo = usePostSeo(postId, targetLang);
	const save = useSavePostSeo();
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
			onToast({ tone: 'success', message: __('SEO meta saved.', 'gemtranslate') });
		} catch (err) {
			onToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	if (seo.isLoading) return <FormSkeleton />;

	return (
		<Card title={__('SEO meta for this translation', 'gemtranslate')}>
			<form onSubmit={submit} className="gtrans-flex gtrans-flex-col gtrans-gap-3">
				{FIELDS.map((f) => (
					<div key={f.key}>
						<Field label={f.label()}>
							{f.key.includes('desc') ? (
								<TextArea rows={3} value={form[f.key] || ''} onChange={set(f.key)} />
							) : (
								<TextInput value={form[f.key] || ''} onChange={set(f.key)} />
							)}
						</Field>
					</div>
				))}
				<div className="gtrans-flex gtrans-justify-end">
					<Button type="submit" loading={save.isPending}>{__('Save SEO meta', 'gemtranslate')}</Button>
				</div>
			</form>
		</Card>
	);
}

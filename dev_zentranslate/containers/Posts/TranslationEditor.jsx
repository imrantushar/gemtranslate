import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { LoadingBlock } from '../../components/Spinner';
import { usePostTranslations } from '../../hooks/usePosts';
import {
	usePostVariants,
	useCreateVariant,
	usePromoteToLayout,
	useDemoteToStrings,
} from '../../hooks/usePostFields';
import { formatErrorMessage } from '../../lib/format';
import SeoTab from './SeoTab';
import MetaTab from './MetaTab';
import FieldsTab from './FieldsTab';
import HistoryTab from './HistoryTab';
import ModeSwitcher from './ModeSwitcher';

export default function TranslationEditor() {
	const { id } = useParams();
	const data = usePostTranslations(id);
	const promote = usePromoteToLayout();
	const demote = useDemoteToStrings();
	const createVariant = useCreateVariant();
	const [selectedLang, setSelectedLang] = useState('');
	const [country, setCountry] = useState('');
	const [tab, setTab] = useState('content');
	const [toast, setToast] = useState(null);
	const variants = usePostVariants(id, selectedLang);

	// Mode for the selected (lang, country) row. Defaults to string_only for
	// new translations; reads from the row when it exists.
	const variantRow = (variants.data || []).find((v) => (v.country_code || '') === country) || null;
	const mode = variantRow?.translation_mode || 'string_only';

	useEffect(() => {
		if (!data.data) return;
		const langs = data.data.translations || [];
		if (langs.length === 0) return;
		setSelectedLang((current) => current || langs[0].language.code);
	}, [data.data]);

	if (data.isLoading) return <LoadingBlock>{__('Loading translation editor…', 'zentranslate')}</LoadingBlock>;
	if (data.error) return <p className="ztrans-text-red-600">{formatErrorMessage(data.error)}</p>;
	if (!data.data) return null;

	const { post, translations, default_lang: defaultLang } = data.data;
	const targetLangs = translations || [];
	const targetRow = targetLangs.find((l) => l.language.code === selectedLang);

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
								onClick={() => {
									setSelectedLang(t.language.code);
									setCountry('');
								}}
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
					</div>

					{/* ---- Country variant strip (tightened) ---- */}
					<div className="ztrans-mb-4 ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-2">
						<span className="ztrans-text-xs ztrans-font-medium ztrans-text-gray-600 ztrans-mr-1">
							{__('Country variant:', 'zentranslate')}
						</span>
						<VariantPill active={country === ''} onClick={() => setCountry('')}>
							{__('Default', 'zentranslate')}
						</VariantPill>
						{(variants.data || [])
							.filter((v) => (v.country_code || '') !== '')
							.map((v) => (
								<VariantPill
									key={v.country_code}
									active={country === v.country_code}
									onClick={() => setCountry(v.country_code)}
								>
									{v.country_code}
								</VariantPill>
							))}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							loading={createVariant.isPending}
							onClick={async () => {
								// eslint-disable-next-line no-alert
								const next = (window.prompt(__('ISO 2-letter country code (e.g. MX)', 'zentranslate')) || '')
									.trim()
									.toUpperCase();
								if (!/^[A-Z]{2}$/.test(next)) return;
								try {
									await createVariant.mutateAsync({ postId: post.id, lang: selectedLang, country_code: next });
									setCountry(next);
									setToast({ tone: 'success', message: __('Country variant added.', 'zentranslate') });
								} catch (err) {
									setToast({ tone: 'error', message: formatErrorMessage(err) });
								}
							}}
						>
							{__('+ Add country', 'zentranslate')}
						</Button>
					</div>

					{/* ---- Mode switcher (cards) ---- */}
					<ModeSwitcher
						mode={mode}
						language={targetRow?.language?.name || selectedLang}
						country={country}
						variantRow={variantRow}
						isPromoting={promote.isPending}
						isDemoting={demote.isPending}
						onPromote={async () => {
							try {
								await promote.mutateAsync({ postId: post.id, lang: selectedLang, country });
								setTab('content');
								setToast({ tone: 'success', message: __('Switched to custom layout. Open it in your editor to design the page.', 'zentranslate') });
							} catch (err) {
								setToast({ tone: 'error', message: formatErrorMessage(err) });
							}
						}}
						onDemote={async () => {
							try {
								await demote.mutateAsync({ postId: post.id, lang: selectedLang, country });
								setTab('content');
								setToast({ tone: 'success', message: __('Reverted to strings-only mode.', 'zentranslate') });
							} catch (err) {
								setToast({ tone: 'error', message: formatErrorMessage(err) });
							}
						}}
					/>

					{/* ---- Tabs ---- */}
					<div className="ztrans-mb-4 ztrans-flex ztrans-border-b ztrans-border-ztrans-border">
						{[
							{ key: 'content', label: __('Content', 'zentranslate') },
							{ key: 'meta', label: __('Custom fields', 'zentranslate') },
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

					{/* ---- Tab content ---- */}
					{tab === 'meta' ? (
						<MetaTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} />
					) : tab === 'seo' ? (
						<SeoTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} onToast={setToast} />
					) : tab === 'history' ? (
						<HistoryTab postId={post.id} targetLang={selectedLang} />
					) : mode === 'string_only' ? (
						<FieldsTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} country={country} />
					) : (
						<CustomLayoutPanel variantRow={variantRow} updatedAt={targetRow?.translation?.updated_at} />
					)}
				</>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

function VariantPill({ active, onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`ztrans-bare ztrans-rounded-full ztrans-px-3 ztrans-py-1 ztrans-text-xs ${
				active
					? 'ztrans-bg-ztrans-primary ztrans-text-white'
					: 'ztrans-bg-white ztrans-border ztrans-border-ztrans-border ztrans-text-gray-700'
			}`}
		>
			{children}
		</button>
	);
}

function CustomLayoutPanel({ variantRow, updatedAt }) {
	if (!variantRow?.shadow_edit_url) {
		return (
			<Card>
				<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">
					{__('Setting up the custom layout… this should only take a moment.', 'zentranslate')}
				</p>
			</Card>
		);
	}
	return (
		<Card title={__('Edit in WordPress', 'zentranslate')}>
			<p className="ztrans-mb-3 ztrans-text-sm ztrans-text-gray-700">
				{__('This translation is a real WordPress post — edit it in Gutenberg, Elementor, Beaver, Divi, Bricks, or any builder you have installed.', 'zentranslate')}
			</p>
			<div className="ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-gap-3">
				<a
					href={variantRow.shadow_edit_url}
					target="_blank"
					rel="noopener noreferrer"
					className="ztrans-inline-flex ztrans-items-center ztrans-gap-2 ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-4 ztrans-py-2 ztrans-text-sm ztrans-font-medium ztrans-text-white ztrans-no-underline hover:ztrans-bg-ztrans-primary-hover"
				>
					{__('Open in editor →', 'zentranslate')}
				</a>
				{updatedAt && (
					<span className="ztrans-text-xs ztrans-text-ztrans-muted">
						{sprintf(/* translators: %s: ISO timestamp. */ __('Last edited %s', 'zentranslate'), updatedAt)}
					</span>
				)}
				<span className="ztrans-ml-auto ztrans-text-xs ztrans-text-ztrans-muted">
					{__('Shadow post ID', 'zentranslate')}: <code>{variantRow.shadow_post_id}</code>
				</span>
			</div>
			<p className="ztrans-mt-4 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
				{__('Use "Revert to strings" in the mode switcher above to discard this layout and switch back to text-only translation.', 'zentranslate')}
			</p>
		</Card>
	);
}

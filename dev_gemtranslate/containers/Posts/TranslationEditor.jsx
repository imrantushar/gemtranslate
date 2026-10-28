import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Toast from '../../components/Toast';
import { PageSkeleton } from '../../components/Skeleton';
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
import AdvancedEditor from './AdvancedEditor';
import BlockwiseEditor from './BlockwiseEditor';
import HistoryTab from './HistoryTab';
import ModeSwitcher from './ModeSwitcher';
import { hasFeature } from '../../hooks/useFeatures';

export default function TranslationEditor() {
	const { id } = useParams();
	const data = usePostTranslations(id);
	const promote = usePromoteToLayout();
	const demote = useDemoteToStrings();
	const createVariant = useCreateVariant();
	const [selectedLang, setSelectedLang] = useState('');
	const [country, setCountry] = useState('');
	const [tab, setTab] = useState('content');
	const [contentMode, setContentMode] = useState(null);
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

	if (data.isLoading)
		return <PageSkeleton />;
	if (data.error) return <p className="gtrans-text-red-600">{formatErrorMessage(data.error)}</p>;
	if (!data.data) return null;

	const { post, translations, default_lang: defaultLang } = data.data;
	const targetLangs = translations || [];
	// Elementor pages have no useful post_content, so open block-wise by default.
	const activeContentMode = contentMode || (post.builder === 'elementor' ? 'blocks' : 'advanced');
	const targetRow = targetLangs.find((l) => l.language.code === selectedLang);

	const addCountry = async () => {
		// eslint-disable-next-line no-alert
		const next = (window.prompt(__('ISO 2-letter country code (e.g. MX)', 'gemtranslate')) || '')
			.trim()
			.toUpperCase();
		if (!/^[A-Z]{2}$/.test(next)) return;
		try {
			await createVariant.mutateAsync({ postId: post.id, lang: selectedLang, country_code: next });
			setCountry(next);
			setToast({ tone: 'success', message: __('Country variant added.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			{targetLangs.length === 0 ? (
				<>
				<PageHeader
					title={sprintf(
						/* translators: %s: post title. */
						__('Translate: %s', 'gemtranslate'),
						post.title
					)}
					description={sprintf(
						/* translators: %s: source language code. */
						__(
							'Source language: %s. Pick a target language and edit the translation.',
							'gemtranslate'
						),
						defaultLang
					)}
					actions={
						<Link
							to="/posts"
							className="gtrans-text-sm gtrans-text-primary gtrans-no-underline"
						>
							{__('← Back to posts', 'gemtranslate')}
						</Link>
					}
				/>

				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{__(
							'Add at least one non-default language to start translating posts.',
							'gemtranslate'
						)}
					</p>
				</Card>
				</>
			) : (
				<>
					<div className="gtrans-sticky-head gtrans-sticky-head--gap">
						<header className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-x-4 gtrans-gap-y-1 gtrans-pb-3">
							<div className="gtrans-min-w-0">
								<h1 className="gtrans-m-0 gtrans-truncate gtrans-text-xl gtrans-font-semibold gtrans-text-heading">
									{sprintf(
										/* translators: %s: post title. */
										__('Translate: %s', 'gemtranslate'),
										post.title
									)}
								</h1>
								<p className="gtrans-m-0 gtrans-text-xs gtrans-text-description">
									{sprintf(
										/* translators: %s: source language code. */
										__('Source language: %s', 'gemtranslate'),
										defaultLang
									)}
								</p>
							</div>
							<Link to="/posts" className="gtrans-text-sm gtrans-text-primary gtrans-no-underline">
								{__('← Back to posts', 'gemtranslate')}
							</Link>
						</header>

						<div className="gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-px-5">
							{/* Language · country · layout mode — one compact row */}
							<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-x-5 gtrans-gap-y-2 gtrans-border-b gtrans-border-line gtrans-py-3">
								<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1.5">
									{targetLangs.map((t) => (
										<button
											key={t.language.code}
											type="button"
											title={t.translation?.status || __('Not translated yet', 'gemtranslate')}
											onClick={() => {
												setSelectedLang(t.language.code);
												setCountry('');
											}}
											className={`gtrans-bare gtrans-inline-flex gtrans-cursor-pointer gtrans-items-center gtrans-gap-2 gtrans-rounded-md gtrans-border gtrans-px-3 gtrans-py-1.5 gtrans-text-sm ${
												selectedLang === t.language.code
													? 'gtrans-border-primary gtrans-bg-primary gtrans-text-white'
													: 'gtrans-border-line gtrans-bg-surface gtrans-text-label hover:gtrans-bg-body'
											}`}
										>
											<span
												aria-hidden="true"
												className={`gtrans-h-2 gtrans-w-2 gtrans-rounded-full ${
													t.translation?.status === 'publish' || t.translation?.status === 'translated'
														? 'gtrans-bg-emerald-400'
														: t.translation
															? 'gtrans-bg-amber-400'
															: 'gtrans-bg-gray-300'
												}`}
											/>
											{t.language.name}
										</button>
									))}
								</div>

								<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-1.5">
									<span className="gtrans-text-xs gtrans-text-muted">{__('Country:', 'gemtranslate')}</span>
									<VariantPill active={country === ''} onClick={() => setCountry('')}>
										{__('Default', 'gemtranslate')}
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
									<button
										type="button"
										disabled={createVariant.isPending}
										onClick={addCountry}
										className="gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-bg-transparent gtrans-px-1 gtrans-text-xs gtrans-text-primary hover:gtrans-underline"
									>
										{__('+ Add', 'gemtranslate')}
									</button>
								</div>

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
										setToast({
											tone: 'success',
											message: __(
												'Switched to custom layout. Open it in your editor to design the page.',
												'gemtranslate'
											),
										});
									} catch (err) {
										setToast({ tone: 'error', message: formatErrorMessage(err) });
									}
								}}
								onDemote={async () => {
									try {
										await demote.mutateAsync({ postId: post.id, lang: selectedLang, country });
										setTab('content');
										setToast({
											tone: 'success',
											message: __('Reverted to strings-only mode.', 'gemtranslate'),
										});
									} catch (err) {
										setToast({ tone: 'error', message: formatErrorMessage(err) });
									}
								}}
							/>

							</div>

							{/* Tabs + editor style */}
							<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-2">
								<div className="gtrans-flex">
									{[
										{ key: 'content', label: __('Content', 'gemtranslate') },
										{ key: 'meta', label: __('Custom fields', 'gemtranslate'), pro: 'custom_fields' },
										{ key: 'seo', label: __('SEO', 'gemtranslate'), pro: 'seo_advanced' },
										{ key: 'history', label: __('History', 'gemtranslate'), pro: 'revisions' },
									]
										.filter((t) => !t.pro || hasFeature(t.pro))
										.map((t) => (
											<button
												key={t.key}
												type="button"
												onClick={() => setTab(t.key)}
												className={`gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-border-b-2 gtrans-bg-transparent gtrans-px-4 gtrans-py-3 gtrans-text-sm ${
													tab === t.key
														? 'gtrans-border-primary gtrans-text-primary gtrans-font-semibold'
														: 'gtrans-border-transparent gtrans-text-muted hover:gtrans-text-ink'
												}`}
												style={{ borderBottomStyle: 'solid' }}
											>
												{t.label}
											</button>
										))}
								</div>

								{tab === 'content' && mode === 'string_only' && (
									<div className="gtrans-flex gtrans-items-center gtrans-gap-1 gtrans-text-xs">
										<span className="gtrans-mr-1 gtrans-text-muted">{__('Editor:', 'gemtranslate')}</span>
										{[
											{ key: 'advanced', label: __('Advanced', 'gemtranslate') },
											{ key: 'blocks', label: __('Blocks', 'gemtranslate') },
											{ key: 'simple', label: __('Simple', 'gemtranslate') },
										].map((o, i, all) => (
											<button
												key={o.key}
												type="button"
												onClick={() => setContentMode(o.key)}
												className={`gtrans-bare gtrans-cursor-pointer gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-1 ${
													i === 0 ? 'gtrans-rounded-l-md' : '-gtrans-ml-px'
												} ${i === all.length - 1 ? 'gtrans-rounded-r-md' : ''} ${
													activeContentMode === o.key ? 'gtrans-bg-primary gtrans-text-white' : 'gtrans-bg-surface gtrans-text-label'
												}`}
											>
												{o.label}
											</button>
										))}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="gtrans-pt-1">
					{/* ---- Tab content ---- */}
					{tab === 'meta' ? (
						<MetaTab postId={post.id} sourceLang={defaultLang} targetLang={selectedLang} />
					) : tab === 'seo' ? (
						<SeoTab
							postId={post.id}
							sourceLang={defaultLang}
							targetLang={selectedLang}
							onToast={setToast}
						/>
					) : tab === 'history' ? (
						<HistoryTab postId={post.id} targetLang={selectedLang} />
					) : mode === 'string_only' ? (
						<>
							{activeContentMode === 'blocks' ? (
								<BlockwiseEditor
									postId={post.id}
									targetLang={selectedLang}
									country={country}
								/>
							) : activeContentMode === 'advanced' ? (
								<AdvancedEditor
									postId={post.id}
									sourceLang={defaultLang}
									targetLang={selectedLang}
									country={country}
								/>
							) : (
								<FieldsTab
									postId={post.id}
									sourceLang={defaultLang}
									targetLang={selectedLang}
									country={country}
								/>
							)}
						</>
					) : (
						<CustomLayoutPanel
							variantRow={variantRow}
							updatedAt={targetRow?.translation?.updated_at}
						/>
					)}
					</div>
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
			className={`gtrans-bare gtrans-rounded-full gtrans-px-3 gtrans-py-1 gtrans-text-xs ${
				active
					? 'gtrans-bg-primary gtrans-text-white'
					: 'gtrans-bg-surface gtrans-border gtrans-border-line gtrans-text-label'
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
				<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
					{__('Setting up the custom layout… this should only take a moment.', 'gemtranslate')}
				</p>
			</Card>
		);
	}
	return (
		<Card title={__('Edit in WordPress', 'gemtranslate')}>
			<p className="gtrans-mb-3 gtrans-text-sm gtrans-text-label">
				{__(
					'This translation is a real WordPress post — edit it in Gutenberg, Elementor, Beaver, Divi, Bricks, or any builder you have installed.',
					'gemtranslate'
				)}
			</p>
			<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
				<a
					href={variantRow.shadow_edit_url}
					target="_blank"
					rel="noopener noreferrer"
					className="gtrans-inline-flex gtrans-items-center gtrans-gap-2 gtrans-rounded-md gtrans-bg-primary gtrans-px-4 gtrans-py-2 gtrans-text-sm gtrans-font-medium gtrans-text-white gtrans-no-underline hover:gtrans-bg-primary-hover"
				>
					{__('Open in editor →', 'gemtranslate')}
				</a>
				{updatedAt && (
					<span className="gtrans-text-xs gtrans-text-muted">
						{sprintf(
							/* translators: %s: ISO timestamp. */ __('Last edited %s', 'gemtranslate'),
							updatedAt
						)}
					</span>
				)}
				<span className="gtrans-ml-auto gtrans-text-xs gtrans-text-muted">
					{__('Shadow post ID', 'gemtranslate')}: <code>{variantRow.shadow_post_id}</code>
				</span>
			</div>
			<p className="gtrans-mt-4 gtrans-mb-0 gtrans-text-xs gtrans-text-muted">
				{__(
					'Use "Revert to strings" in the mode switcher above to discard this layout and switch back to text-only translation.',
					'gemtranslate'
				)}
			</p>
		</Card>
	);
}

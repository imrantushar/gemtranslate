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
import AdvancedEditor from './AdvancedEditor';
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
	const [contentMode, setContentMode] = useState('advanced');
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
		return <LoadingBlock>{__('Loading translation editor…', 'gemtranslate')}</LoadingBlock>;
	if (data.error) return <p className="gtrans-text-red-600">{formatErrorMessage(data.error)}</p>;
	if (!data.data) return null;

	const { post, translations, default_lang: defaultLang } = data.data;
	const targetLangs = translations || [];
	const targetRow = targetLangs.find((l) => l.language.code === selectedLang);

	return (
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

			{targetLangs.length === 0 ? (
				<Card>
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
						{__(
							'Add at least one non-default language to start translating posts.',
							'gemtranslate'
						)}
					</p>
				</Card>
			) : (
				<>
					<div className="gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2">
						{targetLangs.map((t) => (
							<button
								key={t.language.code}
								onClick={() => {
									setSelectedLang(t.language.code);
									setCountry('');
								}}
								className={`gtrans-bare gtrans-rounded-md gtrans-px-3 gtrans-py-1.5 gtrans-text-sm ${
									selectedLang === t.language.code
										? 'gtrans-bg-primary gtrans-text-white'
										: 'gtrans-bg-surface gtrans-border gtrans-border-line gtrans-text-label'
								}`}
							>
								{t.language.name}
								{t.translation && (
									<span className="gtrans-ml-2 gtrans-text-xs gtrans-opacity-80">
										({t.translation.status})
									</span>
								)}
							</button>
						))}
					</div>

					{/* ---- Country variant strip (tightened) ---- */}
					<div className="gtrans-mb-4 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2">
						<span className="gtrans-text-xs gtrans-font-medium gtrans-text-muted gtrans-mr-1">
							{__('Country variant:', 'gemtranslate')}
						</span>
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
						<Button
							type="button"
							variant="ghost"
							size="sm"
							loading={createVariant.isPending}
							onClick={async () => {
								// eslint-disable-next-line no-alert
								const next = (
									window.prompt(__('ISO 2-letter country code (e.g. MX)', 'gemtranslate')) || ''
								)
									.trim()
									.toUpperCase();
								if (!/^[A-Z]{2}$/.test(next)) return;
								try {
									await createVariant.mutateAsync({
										postId: post.id,
										lang: selectedLang,
										country_code: next,
									});
									setCountry(next);
									setToast({
										tone: 'success',
										message: __('Country variant added.', 'gemtranslate'),
									});
								} catch (err) {
									setToast({ tone: 'error', message: formatErrorMessage(err) });
								}
							}}
						>
							{__('+ Add country', 'gemtranslate')}
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

					{/* ---- Tabs ---- */}
					<div className="gtrans-mb-4 gtrans-flex gtrans-border-b gtrans-border-line">
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
									className={`gtrans-bare gtrans-px-4 gtrans-py-2 gtrans-text-sm gtrans-border-b-2 ${
										tab === t.key
											? 'gtrans-border-primary gtrans-text-primary gtrans-font-semibold'
											: 'gtrans-border-transparent gtrans-text-muted hover:gtrans-text-ink'
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
							<div className="gtrans-mb-3 gtrans-flex gtrans-items-center gtrans-justify-end gtrans-gap-1 gtrans-text-xs">
								<span className="gtrans-mr-1 gtrans-text-muted">
									{__('Editor:', 'gemtranslate')}
								</span>
								<button
									type="button"
									onClick={() => setContentMode('advanced')}
									className={`gtrans-bare gtrans-rounded-l-md gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-1 ${
										contentMode === 'advanced'
											? 'gtrans-bg-primary gtrans-text-white'
											: 'gtrans-bg-surface gtrans-text-label'
									}`}
								>
									{__('Advanced', 'gemtranslate')}
								</button>
								<button
									type="button"
									onClick={() => setContentMode('simple')}
									className={`gtrans-bare -gtrans-ml-px gtrans-rounded-r-md gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-1 ${
										contentMode === 'simple'
											? 'gtrans-bg-primary gtrans-text-white'
											: 'gtrans-bg-surface gtrans-text-label'
									}`}
								>
									{__('Simple', 'gemtranslate')}
								</button>
							</div>
							{contentMode === 'advanced' ? (
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

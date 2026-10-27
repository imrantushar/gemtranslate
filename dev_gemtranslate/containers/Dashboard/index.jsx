import { Link } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { LoadingBlock } from '../../components/Spinner';
import { useStats } from '../../hooks/useSettings';
import { useLanguages } from '../../hooks/useLanguages';

function IconBadge({ children }) {
	return (
		<span className="gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded-lg gtrans-bg-primary-light gtrans-text-sm gtrans-text-primary" aria-hidden="true">
			{children}
		</span>
	);
}

function Stat({ icon, label, value, hint, progress }) {
	return (
		<div className="gtrans-flex gtrans-flex-col gtrans-gap-3 gtrans-rounded-lg gtrans-border gtrans-border-edge gtrans-bg-surface gtrans-p-5 gtrans-shadow-gtrans">
			<div className="gtrans-flex gtrans-items-start gtrans-justify-between gtrans-gap-2">
				<div className="gtrans-text-sm gtrans-font-medium gtrans-text-muted">{label}</div>
				<IconBadge>{icon}</IconBadge>
			</div>
			<div className="gtrans-text-3xl gtrans-font-semibold gtrans-leading-none gtrans-text-ink">{value}</div>
			{typeof progress === 'number' ? (
				<div className="gtrans-flex gtrans-items-center gtrans-gap-2">
					<div className="gtrans-h-1.5 gtrans-flex-1 gtrans-overflow-hidden gtrans-rounded-full gtrans-bg-line">
						<div
							className="gtrans-h-full gtrans-rounded-full gtrans-bg-primary"
							style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
						/>
					</div>
					<span className="gtrans-text-xs gtrans-font-medium gtrans-text-muted">{progress}%</span>
				</div>
			) : (
				hint && <div className="gtrans-text-xs gtrans-text-muted">{hint}</div>
			)}
		</div>
	);
}

function LanguageRow({ code, name, nativeName, status }) {
	return (
		<li className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-rounded gtrans-bg-body gtrans-px-3 gtrans-py-2">
			<span className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-text-ink">
				<span className="gtrans-flex gtrans-h-6 gtrans-w-6 gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-bg-line gtrans-text-2xs gtrans-font-semibold gtrans-uppercase gtrans-text-label">
					{code}
				</span>
				<strong className="gtrans-font-medium">{name}</strong>
				{nativeName && <span className="gtrans-text-xs gtrans-text-muted">{nativeName}</span>}
			</span>
			{status === 'default' && <span className="gtrans-text-xs gtrans-text-muted">{__('Default', 'gemtranslate')}</span>}
			{status === 'active' && (
				<span className="gtrans-flex gtrans-items-center gtrans-gap-1.5 gtrans-text-xs gtrans-font-medium gtrans-text-success">
					<span className="gtrans-h-1.5 gtrans-w-1.5 gtrans-rounded-full gtrans-bg-success" />
					{__('Active', 'gemtranslate')}
				</span>
			)}
			{status === 'inactive' && <span className="gtrans-text-xs gtrans-text-muted">{__('Inactive', 'gemtranslate')}</span>}
		</li>
	);
}

export default function Dashboard() {
	const stats = useStats();
	const languages = useLanguages();

	if (stats.isLoading || languages.isLoading) {
		return <LoadingBlock>{__('Loading dashboard…', 'gemtranslate')}</LoadingBlock>;
	}

	const data = stats.data || {};
	const langs = languages.data || [];
	const activeNonDefault = langs.filter((l) => !l.is_default && l.active).length;
	const stringsTotal = data.strings_total ?? 0;
	const stringsTranslated = data.strings_translated ?? 0;
	const stringsPct = stringsTotal > 0 ? Math.round((stringsTranslated / stringsTotal) * 100) : 0;
	const coverageLangCount = data.per_language ? Object.keys(data.per_language).length : 0;

	return (
		<>
			<PageHeader
				title={__('Dashboard', 'gemtranslate')}
				description={__('Quick overview of your multilingual setup.', 'gemtranslate')}
				actions={
					<Link to="/languages" className="gtrans-no-underline">
						<Button variant="primary">
							<span aria-hidden="true">🌐</span>
							{__('Manage languages', 'gemtranslate')}
						</Button>
					</Link>
				}
			/>

			<div className="gtrans-grid gtrans-gap-4 gtrans-grid-cols-2 md:gtrans-grid-cols-4">
				<Stat
					icon="🌐"
					label={__('Active languages', 'gemtranslate')}
					value={data.languages_active ?? 0}
					hint={sprintf(
						/* translators: %d: number of non-default active languages. */
						__('1 default · %d additional', 'gemtranslate'),
						activeNonDefault
					)}
				/>
				<Stat
					icon="📄"
					label={__('Translated posts', 'gemtranslate')}
					value={data.post_translations ?? 0}
					hint={sprintf(
						/* translators: %d: number of languages. */
						__('in %d language(s)', 'gemtranslate'),
						coverageLangCount
					)}
				/>
				<Stat
					icon="T"
					label={__('Translated strings', 'gemtranslate')}
					value={`${stringsTranslated} / ${stringsTotal}`}
					progress={stringsPct}
				/>
				<Stat
					icon="🗄"
					label={__('Translation memory', 'gemtranslate')}
					value={data.tm?.entries ?? 0}
					hint={`${data.tm?.hits ?? 0} ${__('cache hits', 'gemtranslate')}`}
				/>
			</div>

			<div className="gtrans-mt-8 gtrans-grid gtrans-gap-6 md:gtrans-grid-cols-2">
				<Card
					title={__('Languages', 'gemtranslate')}
					action={
						<Link to="/languages" className="gtrans-text-xs gtrans-font-medium gtrans-text-primary gtrans-no-underline">
							{__('Manage', 'gemtranslate')}
						</Link>
					}
				>
					{langs.length === 0 ? (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
							{__('No languages yet. Add one to get started.', 'gemtranslate')}
						</p>
					) : (
						<ul className="gtrans-m-0 gtrans-flex gtrans-flex-col gtrans-gap-2 gtrans-p-0 gtrans-list-none">
							{langs.map((lang) => (
								<LanguageRow
									key={lang.code}
									code={lang.code}
									name={lang.name}
									nativeName={lang.native_name}
									status={lang.is_default ? 'default' : lang.active ? 'active' : 'inactive'}
								/>
							))}
						</ul>
					)}
				</Card>

				<Card
					title={__('Per-language post coverage', 'gemtranslate')}
					action={
						<Link to="/posts" className="gtrans-text-xs gtrans-font-medium gtrans-text-primary gtrans-no-underline">
							{__('View posts', 'gemtranslate')}
						</Link>
					}
				>
					{!data.per_language || Object.keys(data.per_language).length === 0 ? (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
							{__('Add a non-default language and translate posts to see coverage.', 'gemtranslate')}
						</p>
					) : (
						<ul className="gtrans-m-0 gtrans-flex gtrans-flex-col gtrans-gap-2 gtrans-p-0 gtrans-list-none">
							{Object.entries(data.per_language).map(([code, info]) => (
								<li key={code} className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-rounded gtrans-bg-body gtrans-px-3 gtrans-py-2">
									<span className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-text-ink">
										<span className="gtrans-flex gtrans-h-6 gtrans-w-6 gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-bg-line gtrans-text-2xs gtrans-font-semibold gtrans-uppercase gtrans-text-label">
											{code}
										</span>
										<strong className="gtrans-font-medium">{info.language?.name || code}</strong>
									</span>
									<span className="gtrans-text-xs gtrans-text-muted">
										{`${info.translated_posts} ${__('posts', 'gemtranslate')}`}
									</span>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
		</>
	);
}

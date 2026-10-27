import { Link } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { LoadingBlock } from '../../components/Spinner';
import { useStats } from '../../hooks/useSettings';
import { useLanguages } from '../../hooks/useLanguages';

function Stat({ label, value, hint }) {
	return (
		<div className="gtrans-rounded-lg gtrans-bg-white gtrans-p-5 gtrans-shadow-card">
			<div className="gtrans-text-xs gtrans-uppercase gtrans-tracking-wide gtrans-text-gtrans-muted">{label}</div>
			<div className="gtrans-mt-1 gtrans-text-2xl gtrans-font-semibold gtrans-text-gray-900">{value}</div>
			{hint && <div className="gtrans-mt-1 gtrans-text-xs gtrans-text-gtrans-muted">{hint}</div>}
		</div>
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

	return (
		<>
			<PageHeader
				title={__('Dashboard', 'gemtranslate')}
				description={__('Quick overview of your multilingual setup.', 'gemtranslate')}
				actions={
					<Link to="/languages" className="gtrans-inline-flex gtrans-rounded-md gtrans-bg-gtrans-primary gtrans-px-4 gtrans-py-2 gtrans-text-sm gtrans-text-white gtrans-no-underline">
						{__('Manage languages', 'gemtranslate')}
					</Link>
				}
			/>

			<div className="gtrans-grid gtrans-gap-4 gtrans-grid-cols-2 md:gtrans-grid-cols-4">
				<Stat label={__('Active languages', 'gemtranslate')} value={data.languages_active ?? 0} />
				<Stat label={__('Translated posts', 'gemtranslate')} value={data.post_translations ?? 0} />
				<Stat label={__('Translated strings', 'gemtranslate')} value={`${data.strings_translated ?? 0} / ${data.strings_total ?? 0}`} />
				<Stat
					label={__('Translation memory', 'gemtranslate')}
					value={data.tm?.entries ?? 0}
					hint={`${data.tm?.hits ?? 0} ${__('cache hits', 'gemtranslate')}`}
				/>
			</div>

			<div className="gtrans-mt-8 gtrans-grid gtrans-gap-6 md:gtrans-grid-cols-2">
				<Card title={__('Languages', 'gemtranslate')}>
					{langs.length === 0 ? (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-gtrans-muted">
							{__('No languages yet. Add one to get started.', 'gemtranslate')}
						</p>
					) : (
						<ul className="gtrans-m-0 gtrans-flex gtrans-flex-col gtrans-gap-2 gtrans-p-0 gtrans-list-none">
							{langs.map((lang) => (
								<li key={lang.code} className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-rounded-md gtrans-bg-gtrans-bg gtrans-px-3 gtrans-py-2">
									<span className="gtrans-text-sm">
										<strong>{lang.name}</strong>
										<span className="gtrans-ml-2 gtrans-text-xs gtrans-text-gtrans-muted">{lang.code}</span>
									</span>
									<span className="gtrans-text-xs gtrans-text-gtrans-muted">
										{lang.is_default
											? __('Default', 'gemtranslate')
											: lang.active
												? __('Active', 'gemtranslate')
												: __('Inactive', 'gemtranslate')}
									</span>
								</li>
							))}
						</ul>
					)}
				</Card>

				<Card title={__('Per-language post coverage', 'gemtranslate')}>
					{!data.per_language || Object.keys(data.per_language).length === 0 ? (
						<p className="gtrans-m-0 gtrans-text-sm gtrans-text-gtrans-muted">
							{__('Add a non-default language and translate posts to see coverage.', 'gemtranslate')}
						</p>
					) : (
						<ul className="gtrans-m-0 gtrans-flex gtrans-flex-col gtrans-gap-2 gtrans-p-0 gtrans-list-none">
							{Object.entries(data.per_language).map(([code, info]) => (
								<li key={code} className="gtrans-flex gtrans-items-center gtrans-justify-between gtrans-rounded-md gtrans-bg-gtrans-bg gtrans-px-3 gtrans-py-2">
									<span className="gtrans-text-sm">
										<strong>{info.language?.name || code}</strong>
									</span>
									<span className="gtrans-text-xs gtrans-text-gtrans-muted">
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

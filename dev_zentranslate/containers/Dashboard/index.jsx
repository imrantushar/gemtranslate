import { Link } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import { LoadingBlock } from '../../components/Spinner';
import { useStats } from '../../hooks/useSettings';
import { useLanguages } from '../../hooks/useLanguages';

function Stat({ label, value, hint }) {
	return (
		<div className="ztrans-rounded-lg ztrans-bg-white ztrans-p-5 ztrans-shadow-card">
			<div className="ztrans-text-xs ztrans-uppercase ztrans-tracking-wide ztrans-text-ztrans-muted">{label}</div>
			<div className="ztrans-mt-1 ztrans-text-2xl ztrans-font-semibold ztrans-text-gray-900">{value}</div>
			{hint && <div className="ztrans-mt-1 ztrans-text-xs ztrans-text-ztrans-muted">{hint}</div>}
		</div>
	);
}

export default function Dashboard() {
	const stats = useStats();
	const languages = useLanguages();

	if (stats.isLoading || languages.isLoading) {
		return <LoadingBlock>Loading dashboard…</LoadingBlock>;
	}

	const data = stats.data || {};
	const langs = languages.data || [];

	return (
		<>
			<PageHeader
				title="Dashboard"
				description="Quick overview of your multilingual setup."
				actions={
					<Link to="/languages" className="ztrans-inline-flex ztrans-rounded-md ztrans-bg-ztrans-primary ztrans-px-4 ztrans-py-2 ztrans-text-sm ztrans-text-white ztrans-no-underline">
						Manage languages
					</Link>
				}
			/>

			<div className="ztrans-grid ztrans-gap-4 ztrans-grid-cols-2 md:ztrans-grid-cols-4">
				<Stat label="Active languages" value={data.languages_active ?? 0} />
				<Stat label="Translated posts" value={data.post_translations ?? 0} />
				<Stat label="Translated strings" value={`${data.strings_translated ?? 0} / ${data.strings_total ?? 0}`} />
				<Stat label="Translation memory" value={data.tm?.entries ?? 0} hint={`${data.tm?.hits ?? 0} cache hits`} />
			</div>

			<div className="ztrans-mt-8 ztrans-grid ztrans-gap-6 md:ztrans-grid-cols-2">
				<Card title="Languages">
					{langs.length === 0 ? (
						<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">No languages yet. Add one to get started.</p>
					) : (
						<ul className="ztrans-m-0 ztrans-flex ztrans-flex-col ztrans-gap-2 ztrans-p-0 ztrans-list-none">
							{langs.map((lang) => (
								<li key={lang.code} className="ztrans-flex ztrans-items-center ztrans-justify-between ztrans-rounded-md ztrans-bg-ztrans-bg ztrans-px-3 ztrans-py-2">
									<span className="ztrans-text-sm">
										<strong>{lang.name}</strong>
										<span className="ztrans-ml-2 ztrans-text-xs ztrans-text-ztrans-muted">{lang.code}</span>
									</span>
									<span className="ztrans-text-xs ztrans-text-ztrans-muted">
										{lang.is_default ? 'Default' : lang.active ? 'Active' : 'Inactive'}
									</span>
								</li>
							))}
						</ul>
					)}
				</Card>

				<Card title="Per-language post coverage">
					{!data.per_language || Object.keys(data.per_language).length === 0 ? (
						<p className="ztrans-m-0 ztrans-text-sm ztrans-text-ztrans-muted">Add a non-default language and translate posts to see coverage.</p>
					) : (
						<ul className="ztrans-m-0 ztrans-flex ztrans-flex-col ztrans-gap-2 ztrans-p-0 ztrans-list-none">
							{Object.entries(data.per_language).map(([code, info]) => (
								<li key={code} className="ztrans-flex ztrans-items-center ztrans-justify-between ztrans-rounded-md ztrans-bg-ztrans-bg ztrans-px-3 ztrans-py-2">
									<span className="ztrans-text-sm">
										<strong>{info.language?.name || code}</strong>
									</span>
									<span className="ztrans-text-xs ztrans-text-ztrans-muted">{info.translated_posts} posts</span>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
		</>
	);
}

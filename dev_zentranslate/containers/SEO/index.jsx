import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';

export default function SeoPage() {
	return (
		<>
			<PageHeader
				title="SEO"
				description="Hreflang tags, sitemap entries, and Yoast/RankMath meta are translated automatically."
			/>
			<Card>
				<ul className="ztrans-list-disc ztrans-pl-5 ztrans-text-sm ztrans-text-gray-800">
					<li>Hreflang tags emitted in <code>&lt;head&gt;</code> for every active language plus <code>x-default</code>.</li>
					<li>Core WP sitemaps include alternate URLs.</li>
					<li>Yoast SEO and Rank Math bridges swap meta title / description per language when those plugins are active.</li>
					<li>Per-post SEO overrides are saved via the post translation editor (coming soon UI).</li>
				</ul>
			</Card>
		</>
	);
}

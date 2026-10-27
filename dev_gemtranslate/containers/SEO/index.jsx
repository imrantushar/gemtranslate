import { __ } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';

export default function SeoPage() {
	return (
		<>
			<PageHeader
				title={__('SEO', 'gemtranslate')}
				description={__('Hreflang tags, sitemap entries, and Yoast/RankMath meta are translated automatically.', 'gemtranslate')}
			/>
			<Card>
				<ul className="ztrans-list-disc ztrans-pl-5 ztrans-text-sm ztrans-text-gray-800">
					<li>{__('Hreflang tags emitted in <head> for every active language plus x-default.', 'gemtranslate')}</li>
					<li>{__('Core WP sitemaps include alternate URLs.', 'gemtranslate')}</li>
					<li>{__('Yoast SEO and Rank Math bridges swap meta title / description per language when those plugins are active.', 'gemtranslate')}</li>
					<li>{__('Per-post SEO overrides are saved via the post translation editor (coming soon UI).', 'gemtranslate')}</li>
				</ul>
			</Card>
		</>
	);
}

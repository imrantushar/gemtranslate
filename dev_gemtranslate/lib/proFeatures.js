import { __ } from '@wordpress/i18n';

/**
 * Marketing copy for each Pro feature flag (see gtrans_feature_flags() in
 * includes/functions.php). Drives the full-page promo shown by <ProGate>.
 * `items` are the benefit cards: { icon (components/Icon name), title, desc }.
 */
export const UPGRADE_URL = 'https://gemtranslate.com/pro';

export function getProFeature(key) {
	const all = {
		seo_advanced: {
			title: __('Advanced multilingual SEO', 'gemtranslate'),
			description: __(
				'Rank in every language. Translate titles, meta descriptions and social cards, with Yoast and Rank Math built in.',
				'gemtranslate'
			),
			items: [
				{ icon: 'search', title: __('Translated meta', 'gemtranslate'), desc: __('Per-language SEO titles, descriptions and Open Graph tags.', 'gemtranslate') },
				{ icon: 'swap', title: __('Yoast & Rank Math bridges', 'gemtranslate'), desc: __('Keep your SEO plugin and your translations in sync automatically.', 'gemtranslate') },
				{ icon: 'globe', title: __('hreflang & sitemaps', 'gemtranslate'), desc: __('Language alternates and per-language sitemap entries for search engines.', 'gemtranslate') },
			],
		},
		translators: {
			title: __('Translator roles & contributor workflow', 'gemtranslate'),
			description: __(
				'Bring in human translators with exactly the access they need, and track contributor work through completion.',
				'gemtranslate'
			),
			items: [
				{ icon: 'users', title: __('Scoped access', 'gemtranslate'), desc: __('Limit each translator to specific languages.', 'gemtranslate') },
				{ icon: 'clipboard', title: __('Contributor work', 'gemtranslate'), desc: __('Assign content, add notes and follow progress in one place.', 'gemtranslate') },
				{ icon: 'check', title: __('Email notifications', 'gemtranslate'), desc: __('Translators are notified when work is assigned or completed.', 'gemtranslate') },
			],
		},
		import_export: {
			title: __('XLIFF & CSV import / export', 'gemtranslate'),
			description: __(
				'Work with external translators and CAT tools. Export, translate offline, and import the result back.',
				'gemtranslate'
			),
			items: [
				{ icon: 'upload', title: __('XLIFF 2.1', 'gemtranslate'), desc: __('The standard exchange format for translation tools and agencies.', 'gemtranslate') },
				{ icon: 'file', title: __('CSV', 'gemtranslate'), desc: __('A simple spreadsheet route for strings and posts.', 'gemtranslate') },
				{ icon: 'swap', title: __('Round-trip safe', 'gemtranslate'), desc: __('Import matches rows back to their source content.', 'gemtranslate') },
			],
		},
	};
	return all[key] || null;
}

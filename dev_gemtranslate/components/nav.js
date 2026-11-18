import { __ } from '@wordpress/i18n';

import { usePostTypes } from '../hooks/usePostTypes';
import { canManage } from '../lib/currentUser';

/**
 * Navigation model shared by the header menu and the wp-admin submenu sync.
 * `children` names a key of useSubmenus(); `pro` is a feature flag that shows
 * a PRO badge while locked.
 */
const MANAGER_NAV = [
	{ to: '/dashboard', label: () => __('Dashboard', 'gemtranslate'), icon: 'dashboard' },
	{ to: '/languages', label: () => __('Languages', 'gemtranslate'), icon: 'globe' },
	{ to: '/posts', label: () => __('Posts & Pages', 'gemtranslate'), icon: 'file', children: 'postTypes' },
	{ to: '/terms', label: () => __('Taxonomies', 'gemtranslate'), icon: 'tag', children: 'taxonomies' },
	{ to: '/strings', label: () => __('Strings', 'gemtranslate'), icon: 'type' },
	{ to: '/menus', label: () => __('Menus', 'gemtranslate'), icon: 'menu' },
	{ to: '/patterns', label: () => __('Patterns', 'gemtranslate'), icon: 'panel', children: 'patterns' },
	{
		to: '/translators',
		label: () => __('Translators', 'gemtranslate'),
		icon: 'users',
		pro: 'translators',
		children: 'translators',
	},
	{
		to: '/tools',
		match: ['/tools', '/migration', '/io'],
		label: () => __('Tools', 'gemtranslate'),
		icon: 'swap',
		children: 'tools',
	},
	{ to: '/settings', label: () => __('Settings', 'gemtranslate'), icon: 'settings', children: 'settings' },
];

// Translators only get their assigned work, not the site-wide admin screens.
const TRANSLATOR_NAV = [
	{ to: '/assignments', label: () => __('My assignments', 'gemtranslate'), icon: 'clipboard', badge: 'assignments' },
];

export const NAV = canManage ? MANAGER_NAV : TRANSLATOR_NAV;

/** True when `pathname` belongs to a nav item (its own route or any grouped route). */
export const navMatches = (item, pathname) =>
	(item.match || [item.to]).some((to) => pathname === to || pathname.startsWith(`${to}/`));

// One-line hints shown under each entry in the sidebar layouts.
const POST_TYPE_HINTS = () => ({
	post: __('Blog posts', 'gemtranslate'),
	page: __('Static pages', 'gemtranslate'),
	product: __('Shop products', 'gemtranslate'),
});
const TAXONOMY_HINTS = () => ({
	category: __('Group your posts', 'gemtranslate'),
	post_tag: __('Label your posts', 'gemtranslate'),
	product_cat: __('Group your products', 'gemtranslate'),
	product_tag: __('Label your products', 'gemtranslate'),
});

// Submenu entries for the expandable items. Post types come from the API;
// taxonomies are fixed, with the WooCommerce ones shown only when "product"
// is a registered type.
export function useSubmenus() {
	const postTypes = usePostTypes();
	const types = postTypes.data || [];

	const posts = (
		types.length
			? types.map((t) => ({ key: t.name, label: t.label }))
			: [
					{ key: 'post', label: __('Posts', 'gemtranslate') },
					{ key: 'page', label: __('Pages', 'gemtranslate') },
				]
	).map((c) => ({ ...c, to: `/posts?type=${c.key}`, param: 'type', isDefault: c.key === 'post', icon: 'file', hint: POST_TYPE_HINTS()[c.key] || __('Translate content', 'gemtranslate') }));

	const taxonomies = [
		{ key: 'category', label: __('Categories', 'gemtranslate') },
		{ key: 'post_tag', label: __('Tags', 'gemtranslate') },
		...(types.some((t) => t.name === 'product')
			? [
					{ key: 'product_cat', label: __('Product categories', 'gemtranslate') },
					{ key: 'product_tag', label: __('Product tags', 'gemtranslate') },
				]
			: []),
	].map((c) => ({ ...c, to: `/terms?tax=${c.key}`, param: 'tax', isDefault: c.key === 'category', icon: 'tag', hint: TAXONOMY_HINTS()[c.key] || __('Translate terms', 'gemtranslate') }));

	// Block themes translate template parts; classic themes keep their header /
	// footer text in widgets and the Customizer instead.
	const patterns = (
		window.gtrans?.isClassic
			? [
					{ key: 'widget', label: __('Widgets', 'gemtranslate'), hint: __('Header & footer widgets', 'gemtranslate'), icon: 'panel' },
					{ key: 'customizer', label: __('Theme options', 'gemtranslate'), hint: __('Site title, tagline, footer text', 'gemtranslate'), icon: 'settings' },
				]
			: [
					{ key: 'template_part', label: __('Header & footer', 'gemtranslate'), hint: __('Template parts', 'gemtranslate'), icon: 'panel' },
					{ key: 'pattern', label: __('Patterns', 'gemtranslate'), hint: __('Synced patterns', 'gemtranslate'), icon: 'file' },
					{ key: 'navigation', label: __('Navigation', 'gemtranslate'), hint: __('Menus built with blocks', 'gemtranslate'), icon: 'menu' },
				]
	).map((c, i) => ({ ...c, to: `/patterns?type=${c.key}`, param: 'type', isDefault: i === 0 }));

	const settings = [
		{ key: 'general', label: __('General', 'gemtranslate') },
		{ key: 'switcher', label: __('Language switcher', 'gemtranslate') },
		{ key: 'geo', label: __('Country detection', 'gemtranslate') },
		{ key: 'floating', label: __('Floating switcher', 'gemtranslate') },
		{ key: 'advanced', label: __('Advanced', 'gemtranslate') },
	].map((c) => ({ ...c, to: `/settings?tab=${c.key}`, param: 'tab', isDefault: c.key === 'general' }));

	const translators = [
		{ key: 'contributor', label: __('Contributor', 'gemtranslate'), to: '/assignments', badge: 'assignments' },
	];

	const tools = [
		{ key: 'io', label: __('Import & Export', 'gemtranslate'), to: '/io', pro: 'import_export' },
		{ key: 'migration', label: __('Migration', 'gemtranslate'), to: '/migration' },
	];

	return { postTypes: posts, taxonomies, patterns, settings, translators, tools };
}

// Items shown directly in the header; everything else lives under "More".
export const MORE_PATHS = ['/translators', '/tools'];

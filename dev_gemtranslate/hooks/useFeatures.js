/**
 * Pro feature flags, injected by PHP into `window.ztrans.features`. Free ships
 * them all false; gemtranslate-pro flips them true. Pure reads — no network.
 */
const FLAGS = (typeof window !== 'undefined' && window.ztrans && window.ztrans.features) || {};

export function hasFeature(key) {
	return !!FLAGS[key];
}

export function useFeatures() {
	return FLAGS;
}

export function useFeature(key) {
	return hasFeature(key);
}

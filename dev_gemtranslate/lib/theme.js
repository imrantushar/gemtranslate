import { useCallback, useState } from 'react';

const STORAGE_KEY = 'gtrans_theme';

function initialTheme() {
	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (saved === 'dark' || saved === 'light') return saved;
	} catch (e) {
		// Storage unavailable — fall through to the OS preference.
	}
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme) {
	document.documentElement.setAttribute('data-gtrans-theme', theme);
}

// Stamp before first paint so there is no light flash in dark mode.
apply(initialTheme());

export function useThemeMode() {
	const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-gtrans-theme') || 'light');

	const toggle = useCallback(() => {
		setTheme((prev) => {
			const next = prev === 'dark' ? 'light' : 'dark';
			apply(next);
			try {
				window.localStorage.setItem(STORAGE_KEY, next);
			} catch (e) {
				// Preference just won't persist.
			}
			return next;
		});
	}, []);

	return { isDark: theme === 'dark', toggle };
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import Topbar from './Topbar';
import { NAV, navMatches } from './nav';

/**
 * Mirror the current route onto the wp-admin sidebar's GemTranslate submenu,
 * which links to `admin.php?page=gemtranslate#/route` (see AdminMenu).
 */
function useSyncAdminMenu() {
	const { pathname, search } = useLocation();

	useEffect(() => {
		const items = document.querySelectorAll('#toplevel_page_gemtranslate .wp-submenu li');
		if (!items.length) return;

		const hashes = Array.from(items).map((li) => {
				const href = li.querySelector('a')?.getAttribute('href') || '';
				return href.includes('#') ? href.split('#')[1] : '/dashboard';
			});
			// Prefer the exact child entry (e.g. /posts?type=page); otherwise
			// fall back to the parent route.
			const full = pathname + search;
			const parent = NAV.find((n) => navMatches(n, pathname))?.to;
			const exact = hashes.find((h) => h === full);
			const target = exact || parent || '/dashboard';

			items.forEach((li, i) => {
				li.classList.toggle('current', hashes[i] === target);
			});
		}, [pathname, search]);
}

export default function Layout({ children }) {
	useSyncAdminMenu();

	return (
		<div className="gtrans-app">
			<Topbar />
			<main className="gtrans-min-w-0 gtrans-flex-1 gtrans-overflow-x-clip gtrans-bg-body gtrans-p-6">
				{children}
			</main>
		</div>
	);
}

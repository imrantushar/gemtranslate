import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import Topbar from './Topbar';
import { NAV } from './nav';

/**
 * Mirror the current route onto the wp-admin sidebar's GemTranslate submenu,
 * which links to `admin.php?page=gemtranslate#/route` (see AdminMenu).
 */
function useSyncAdminMenu() {
	const { pathname } = useLocation();

	useEffect(() => {
		const items = document.querySelectorAll('#toplevel_page_gemtranslate .wp-submenu li');
		if (!items.length) return;

		const routes = NAV.map((n) => n.to).sort((a, b) => b.length - a.length);
		const match = routes.find((to) => pathname === to || pathname.startsWith(`${to}/`));

		items.forEach((li) => {
			const href = li.querySelector('a')?.getAttribute('href') || '';
			const hash = href.includes('#') ? href.split('#')[1] : '/dashboard';
			li.classList.toggle('current', hash === (match || '/dashboard'));
		});
	}, [pathname]);
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

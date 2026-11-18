import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import Topbar from './Topbar';
import { NAV, navMatches } from './nav';

/**
 * Mirror the current route onto the wp-admin sidebar's GemTranslate submenu,
 * which links to `admin.php?page=gemtranslate#/route` (see AdminMenu).
 *
 * Same pattern as GemCRM: nested entries (tagged `gtrans-sub` in PHP) are moved
 * into a child <ul class="wp-submenu"> under their parent. The active parent
 * keeps that list expanded inline; other parents show it as a hover flyout.
 */
function nestAdminMenu(root) {
	if (root.dataset.gtransNested) return;
	root.dataset.gtransNested = '1';

	let parent = null;
	Array.from(root.children).forEach((li) => {
		if (li.classList.contains('gtrans-sub')) {
			if (!parent) return;
			let ul = parent.querySelector(':scope > ul.gtrans-submenu');
			if (!ul) {
				ul = document.createElement('ul');
				ul.className = 'wp-submenu gtrans-submenu';
				parent.appendChild(ul);
				parent.classList.add('gtrans-has-flyout');
				const chevron = document.createElement('span');
				chevron.className = 'gtrans-chevron';
				chevron.setAttribute('aria-hidden', 'true');
				chevron.textContent = '›';
				parent.querySelector('a')?.appendChild(chevron);
			}
			ul.appendChild(li);
		} else if (!li.classList.contains('wp-submenu-head')) {
			parent = li;
		}
	});
}

function useSyncAdminMenu() {
	const { pathname, search } = useLocation();

	useEffect(() => {
		const root = document.querySelector('#toplevel_page_gemtranslate .wp-submenu');
		if (!root) return;
		nestAdminMenu(root);

		const hashOf = (li) => {
			const href = li.querySelector('a')?.getAttribute('href') || '';
			return href.includes('#') ? href.split('#')[1] : '/dashboard';
		};
		const lis = Array.from(root.querySelectorAll('li')).filter((li) => li.querySelector('a'));

		// Prefer the exact child entry (e.g. /posts?type=page); otherwise the parent route.
		const full = pathname + search;
		const parentRoute = NAV.find((n) => navMatches(n, pathname))?.to;
		const target = lis.some((li) => hashOf(li) === full) ? full : parentRoute || '/dashboard';

		lis.forEach((li) => {
			const isChild = li.classList.contains('gtrans-sub');
			const hit = hashOf(li) === target;
			// A parent is "current" (submenu expanded) when it or any child is the target.
			const open =
				!isChild && (hit || Array.from(li.querySelectorAll('li')).some((c) => hashOf(c) === target));
			li.classList.toggle('current', isChild ? hit : open);
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

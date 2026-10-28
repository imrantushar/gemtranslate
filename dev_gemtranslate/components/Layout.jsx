import { useState } from 'react';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

const STORAGE_KEY = 'gtrans_menu_collapsed';

function readCollapsed() {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === '1';
	} catch (e) {
		return false;
	}
}

export default function Layout({ children }) {
	const [collapsed, setCollapsed] = useState(readCollapsed);

	const toggle = () =>
		setCollapsed((prev) => {
			try {
				window.localStorage.setItem(STORAGE_KEY, prev ? '0' : '1');
			} catch (e) {
				// Storage unavailable — the toggle still works for this session.
			}
			return !prev;
		});

	return (
		<div className="gtrans-app">
			<Topbar collapsed={collapsed} onToggle={toggle} />
			<div className="gtrans-flex gtrans-min-w-0 gtrans-flex-1">
				<Sidebar collapsed={collapsed} onToggle={toggle} />
				<main className="gtrans-min-w-0 gtrans-flex-1 gtrans-overflow-x-auto gtrans-bg-body gtrans-p-6">
					{children}
				</main>
			</div>
		</div>
	);
}

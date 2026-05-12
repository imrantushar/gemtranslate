import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';

import App from './App';
import { queryClient } from './lib/query-client';
import './styles/main.css';

function boot() {
	const target = document.getElementById('zentranslate-admin-root');
	if (!target) return;
	const root = createRoot(target);
	root.render(
		<QueryClientProvider client={queryClient}>
			<HashRouter>
				<App />
			</HashRouter>
		</QueryClientProvider>
	);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}

import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';

import App from './App';
import { queryClient } from './lib/query-client';
import { store } from './lib/store';
import './styles/main.css';

function boot() {
	const target = document.getElementById('gemtranslate-admin-root');
	if (!target) return;
	const root = createRoot(target);
	root.render(
		<Provider store={store}>
			<QueryClientProvider client={queryClient}>
				<HashRouter>
					<App />
				</HashRouter>
			</QueryClientProvider>
		</Provider>
	);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}

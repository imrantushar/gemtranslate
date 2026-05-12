import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './containers/Dashboard';
import Languages from './containers/Languages';
import Posts from './containers/Posts';
import TranslationEditor from './containers/Posts/TranslationEditor';
import Strings from './containers/Strings';
import Menus from './containers/Menus';
import SeoPage from './containers/SEO';
import AIPage from './containers/AI';
import SettingsPage from './containers/Settings';

export default function App() {
	return (
		<Layout>
			<Routes>
				<Route path="/" element={<Navigate to="/dashboard" replace />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/languages" element={<Languages />} />
				<Route path="/posts" element={<Posts />} />
				<Route path="/posts/:id" element={<TranslationEditor />} />
				<Route path="/strings" element={<Strings />} />
				<Route path="/menus" element={<Menus />} />
				<Route path="/seo" element={<SeoPage />} />
				<Route path="/ai" element={<AIPage />} />
				<Route path="/settings" element={<SettingsPage />} />
			</Routes>
		</Layout>
	);
}

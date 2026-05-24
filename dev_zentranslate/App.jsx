import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './containers/Dashboard';
import Languages from './containers/Languages';
import Posts from './containers/Posts';
import TranslationEditor from './containers/Posts/TranslationEditor';
import PackageList from './containers/Strings/PackageList';
import PackageEditor from './containers/Strings/PackageEditor';
import StringsLegacy from './containers/Strings/StringsLegacy';
import Terms from './containers/Terms';
import Menus from './containers/Menus';
import SeoPage from './containers/SEO';
import AIPage from './containers/AI';
import GlossaryPage from './containers/Glossary';
import JobsPage from './containers/Jobs';
import TranslatorsPage from './containers/Translators';
import MigrationPage from './containers/Migration';
import ImportExportPage from './containers/ImportExport';
import SettingsPage from './containers/Settings';
import Onboarding from './containers/Onboarding';
import { useSettings } from './hooks/useSettings';

function FirstRunGate() {
	const settings = useSettings();
	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		if (settings.isLoading) return;
		if (settings.data?.onboarding_complete) return;
		// Don't bounce away if the user has navigated to onboarding themselves
		// or is poking around something else explicitly.
		if (location.pathname === '/onboarding') return;
		if (location.pathname === '/' || location.pathname === '/dashboard') {
			navigate('/onboarding', { replace: true });
		}
	}, [settings.isLoading, settings.data, location.pathname, navigate]);

	return null;
}

export default function App() {
	return (
		<Layout>
			<FirstRunGate />
			<Routes>
				<Route path="/" element={<Navigate to="/dashboard" replace />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/onboarding" element={<Onboarding />} />
				<Route path="/languages" element={<Languages />} />
				<Route path="/posts" element={<Posts />} />
				<Route path="/posts/:id" element={<TranslationEditor />} />
				<Route path="/terms" element={<Terms />} />
				<Route path="/strings" element={<PackageList />} />
				<Route path="/strings/legacy" element={<StringsLegacy />} />
				<Route path="/strings/:slug/:lang" element={<PackageEditor />} />
				<Route path="/menus" element={<Menus />} />
				<Route path="/seo" element={<SeoPage />} />
				<Route path="/ai" element={<AIPage />} />
				<Route path="/glossary" element={<GlossaryPage />} />
				<Route path="/jobs" element={<JobsPage />} />
				<Route path="/translators" element={<TranslatorsPage />} />
				<Route path="/migration" element={<MigrationPage />} />
				<Route path="/io" element={<ImportExportPage />} />
				<Route path="/settings" element={<SettingsPage />} />
			</Routes>
		</Layout>
	);
}

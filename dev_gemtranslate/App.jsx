import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import Layout from './components/Layout';
import Dashboard from './containers/Dashboard';
import Languages from './containers/Languages';
import Posts from './containers/Posts';
import TranslationEditor from './containers/Posts/TranslationEditor';
import AssignmentsPage from './containers/Assignments';
import ProGate from './components/ProGate';
import PackageList from './containers/Strings/PackageList';
import PackageEditor from './containers/Strings/PackageEditor';
import StringsLegacy from './containers/Strings/StringsLegacy';
import Terms from './containers/Terms';
import Menus from './containers/Menus';
import SeoPage from './containers/SEO';
import TranslatorsPage from './containers/Translators';
import MigrationPage from './containers/Migration';
import ImportExportPage from './containers/ImportExport';
import SettingsPage from './containers/Settings';
import Onboarding from './containers/Onboarding';
import { useSettings } from './hooks/useSettings';
import { canManage } from './lib/currentUser';

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

function TranslatorRoutes() {
	return (
		<Routes>
			<Route path="/assignments" element={<AssignmentsPage />} />
			<Route path="/posts/:id" element={<TranslationEditor />} />
			<Route path="*" element={<Navigate to="/assignments" replace />} />
		</Routes>
	);
}

export default function App() {
	if (!canManage) {
		return (
			<Layout>
				<TranslatorRoutes />
			</Layout>
		);
	}

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
				<Route
					path="/seo"
					element={
						<ProGate
							feature="seo_advanced"
							header={__('SEO', 'gemtranslate')}
							title={__('Advanced multilingual SEO', 'gemtranslate')}
							description={__(
								'Translate SEO titles, meta descriptions and Open Graph, with Yoast and Rank Math integration — with GemTranslate Pro.',
								'gemtranslate'
							)}
						>
							<SeoPage />
						</ProGate>
					}
				/>
				<Route
					path="/translators"
					element={
						<ProGate
							feature="translators"
							header={__('Translators', 'gemtranslate')}
							title={__('Translator roles & contributor workflow', 'gemtranslate')}
							description={__(
								'Give translators scoped access to specific languages — with GemTranslate Pro.',
								'gemtranslate'
							)}
						>
							<TranslatorsPage />
						</ProGate>
					}
				/>
				<Route
					path="/assignments"
					element={
						<ProGate
							feature="translators"
							header={__('Contributor', 'gemtranslate')}
							title={__('Contributor workflow', 'gemtranslate')}
							description={__(
								'Assign content to contributors, track their progress, and notify them by email — with GemTranslate Pro.',
								'gemtranslate'
							)}
						>
							<AssignmentsPage />
						</ProGate>
					}
				/>
				<Route path="/migration" element={<MigrationPage />} />
				<Route
					path="/io"
					element={
						<ProGate
							feature="import_export"
							header={__('Import & Export', 'gemtranslate')}
							title={__('XLIFF & CSV import / export', 'gemtranslate')}
							description={__(
								'Exchange translations with external translators and CAT tools — with GemTranslate Pro.',
								'gemtranslate'
							)}
						>
							<ImportExportPage />
						</ProGate>
					}
				/>
				<Route path="/settings" element={<SettingsPage />} />
			</Routes>
		</Layout>
	);
}

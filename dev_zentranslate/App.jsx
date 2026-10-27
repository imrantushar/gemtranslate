import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import Layout from './components/Layout';
import Dashboard from './containers/Dashboard';
import Languages from './containers/Languages';
import Posts from './containers/Posts';
import TranslationEditor from './containers/Posts/TranslationEditor';
import ReviewPage from './containers/Review';
import AssignmentsPage from './containers/Assignments';
import ProGate from './components/ProGate';
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
				<Route
					path="/review"
					element={
						<ProGate
							feature="translate_everything"
							header={__('Review queue', 'zentranslate')}
							title={__('Automatic translation & review queue', 'zentranslate')}
							description={__(
								'Auto-translate content on publish and review it before it goes live — with Zentranslate Pro.',
								'zentranslate'
							)}
						>
							<ReviewPage />
						</ProGate>
					}
				/>
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
							header={__('SEO', 'zentranslate')}
							title={__('Advanced multilingual SEO', 'zentranslate')}
							description={__(
								'Translate SEO titles, meta descriptions and Open Graph, with Yoast and Rank Math integration — with Zentranslate Pro.',
								'zentranslate'
							)}
						>
							<SeoPage />
						</ProGate>
					}
				/>
				<Route path="/ai" element={<AIPage />} />
				<Route
					path="/glossary"
					element={
						<ProGate
							feature="glossary"
							header={__('Glossary', 'zentranslate')}
							title={__('Glossary & do-not-translate terms', 'zentranslate')}
							description={__(
								'Keep brand terms and proper nouns consistent across every translation — with Zentranslate Pro.',
								'zentranslate'
							)}
						>
							<GlossaryPage />
						</ProGate>
					}
				/>
				<Route
					path="/jobs"
					element={
						<ProGate
							feature="ai_bulk"
							header={__('Jobs', 'zentranslate')}
							title={__('Bulk & background translation', 'zentranslate')}
							description={__(
								'Queue bulk AI translations and run them in the background — with Zentranslate Pro.',
								'zentranslate'
							)}
						>
							<JobsPage />
						</ProGate>
					}
				/>
				<Route
					path="/translators"
					element={
						<ProGate
							feature="translators"
							header={__('Translators', 'zentranslate')}
							title={__('Translator roles & assignments', 'zentranslate')}
							description={__(
								'Give translators scoped access to specific languages — with Zentranslate Pro.',
								'zentranslate'
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
							header={__('Assignments', 'zentranslate')}
							title={__('Translator assignments & workflow', 'zentranslate')}
							description={__(
								'Assign content to translators, track their progress, and notify them by email — with Zentranslate Pro.',
								'zentranslate'
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
							header={__('Import & Export', 'zentranslate')}
							title={__('XLIFF & CSV import / export', 'zentranslate')}
							description={__(
								'Exchange translations with external translators and CAT tools — with Zentranslate Pro.',
								'zentranslate'
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

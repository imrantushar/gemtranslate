import { useEffect, useState } from 'react';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Checkbox, Field, Select } from '../../components/Input';
import { LoadingBlock } from '../../components/Spinner';
import { useSettings, useSaveSettings } from '../../hooks/useSettings';
import { formatErrorMessage } from '../../lib/format';

export default function SettingsPage() {
	const settings = useSettings();
	const save = useSaveSettings();
	const [values, setValues] = useState(null);
	const [toast, setToast] = useState(null);

	useEffect(() => {
		if (settings.data && !values) setValues(settings.data);
	}, [settings.data, values]);

	if (settings.isLoading || !values) return <LoadingBlock>Loading settings…</LoadingBlock>;

	const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

	const submit = async () => {
		try {
			await save.mutateAsync(values);
			setToast({ tone: 'success', message: 'Settings saved.' });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title="Settings"
				description="Configure how Zentranslate behaves."
				actions={<Button onClick={submit} loading={save.isPending}>Save changes</Button>}
			/>

			<div className="ztrans-grid ztrans-gap-6 md:ztrans-grid-cols-2">
				<Card title="URL strategy">
					<Field label="Pattern">
						<Select value={values.url_strategy} onChange={(e) => set('url_strategy', e.target.value)} disabled>
							<option value="subdirectory">Subdirectory (/es/, /fr/)</option>
						</Select>
					</Field>
					<p className="ztrans-mt-3 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						Subdirectory URLs cache cleanly with page-cache plugins. Subdomain and per-domain modes are planned for v2.
					</p>
				</Card>

				<Card title="Display">
					<Checkbox
						label="Show switcher for default language"
						checked={!!values.show_switcher_for_default}
						onChange={(e) => set('show_switcher_for_default', e.target.checked)}
					/>
				</Card>

				<Card title="Performance">
					<Checkbox
						label="Use object cache (recommended)"
						checked={!!values.object_cache_enabled}
						onChange={(e) => set('object_cache_enabled', e.target.checked)}
					/>
					<Checkbox
						label="Enable debug log"
						checked={!!values.debug_log_enabled}
						onChange={(e) => set('debug_log_enabled', e.target.checked)}
					/>
				</Card>

				<Card title="Danger zone">
					<Checkbox
						label="Delete all data on uninstall"
						checked={!!values.remove_data_on_uninstall}
						onChange={(e) => set('remove_data_on_uninstall', e.target.checked)}
					/>
					<p className="ztrans-mt-2 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						When enabled, removing the plugin from WP admin drops all <code>wp_ztrans_*</code> tables and clears Zentranslate options.
					</p>
				</Card>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

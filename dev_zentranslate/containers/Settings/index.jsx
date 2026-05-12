import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

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

	if (settings.isLoading || !values) return <LoadingBlock>{__('Loading settings…', 'zentranslate')}</LoadingBlock>;

	const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

	const submit = async () => {
		try {
			await save.mutateAsync(values);
			setToast({ tone: 'success', message: __('Settings saved.', 'zentranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Settings', 'zentranslate')}
				description={__('Configure how Zentranslate behaves.', 'zentranslate')}
				actions={<Button onClick={submit} loading={save.isPending}>{__('Save changes', 'zentranslate')}</Button>}
			/>

			<div className="ztrans-grid ztrans-gap-6 md:ztrans-grid-cols-2">
				<Card title={__('URL strategy', 'zentranslate')}>
					<Field label={__('Pattern', 'zentranslate')}>
						<Select value={values.url_strategy} onChange={(e) => set('url_strategy', e.target.value)} disabled>
							<option value="subdirectory">{__('Subdirectory (/es/, /fr/)', 'zentranslate')}</option>
						</Select>
					</Field>
					<p className="ztrans-mt-3 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('Subdirectory URLs cache cleanly with page-cache plugins. Subdomain and per-domain modes are planned for v2.', 'zentranslate')}
					</p>
				</Card>

				<Card title={__('Display', 'zentranslate')}>
					<Checkbox
						label={__('Show switcher for default language', 'zentranslate')}
						checked={!!values.show_switcher_for_default}
						onChange={(e) => set('show_switcher_for_default', e.target.checked)}
					/>
				</Card>

				<Card title={__('Performance', 'zentranslate')}>
					<Checkbox
						label={__('Use object cache (recommended)', 'zentranslate')}
						checked={!!values.object_cache_enabled}
						onChange={(e) => set('object_cache_enabled', e.target.checked)}
					/>
					<Checkbox
						label={__('Enable debug log', 'zentranslate')}
						checked={!!values.debug_log_enabled}
						onChange={(e) => set('debug_log_enabled', e.target.checked)}
					/>
				</Card>

				<Card title={__('Danger zone', 'zentranslate')}>
					<Checkbox
						label={__('Delete all data on uninstall', 'zentranslate')}
						checked={!!values.remove_data_on_uninstall}
						onChange={(e) => set('remove_data_on_uninstall', e.target.checked)}
					/>
					<p className="ztrans-mt-2 ztrans-mb-0 ztrans-text-xs ztrans-text-ztrans-muted">
						{__('When enabled, removing the plugin from WP admin drops all wp_ztrans_* tables and clears Zentranslate options.', 'zentranslate')}
					</p>
				</Card>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

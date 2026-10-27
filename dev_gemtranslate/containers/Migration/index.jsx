import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import StatusPill from '../../components/StatusPill';
import { LoadingBlock } from '../../components/Spinner';
import { useMigrationDetect, useRunMigration } from '../../hooks/useMigration';
import { formatErrorMessage } from '../../lib/format';

const SOURCES = [
	{ key: 'wpml', label: 'WPML', hint: () => __('Imports languages and post translations from icl_translations.', 'gemtranslate') },
	{ key: 'polylang', label: 'Polylang', hint: () => __('Imports languages and post translations from the language taxonomy.', 'gemtranslate') },
	{ key: 'translatepress', label: 'TranslatePress', hint: () => __('Imports translated UI strings from trp_dictionary tables.', 'gemtranslate') },
];

export default function MigrationPage() {
	const detect = useMigrationDetect();
	const run = useRunMigration();
	const [results, setResults] = useState({});
	const [toast, setToast] = useState(null);

	if (detect.isLoading) return <LoadingBlock>{__('Detecting other multilingual plugins…', 'gemtranslate')}</LoadingBlock>;

	const onRun = async (source) => {
		if (!window.confirm(__('Run import? Existing translations may be overwritten.', 'gemtranslate'))) return;
		try {
			const result = await run.mutateAsync(source);
			setResults((r) => ({ ...r, [source]: result }));
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: posts imported, 2: strings imported. */
					__('Imported %1$d posts and %2$d strings.', 'gemtranslate'),
					result.posts || 0,
					result.strings || 0
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Migration', 'gemtranslate')}
				description={__('Import translations from other multilingual plugins.', 'gemtranslate')}
			/>

			<div className="gtrans-grid gtrans-gap-6 md:gtrans-grid-cols-3">
				{SOURCES.map((s) => {
					const detected = !!detect.data?.[s.key];
					const result = results[s.key];
					return (
						<Card key={s.key} title={s.label}>
							<p className="gtrans-mb-3 gtrans-text-xs gtrans-text-muted">{s.hint()}</p>
							<div className="gtrans-mb-4">
								{detected ? (
									<StatusPill tone="translated">{__('Detected', 'gemtranslate')}</StatusPill>
								) : (
									<StatusPill tone="none">{__('Not detected', 'gemtranslate')}</StatusPill>
								)}
							</div>
							<Button onClick={() => onRun(s.key)} loading={run.isPending} disabled={!detected}>
								{__('Run import', 'gemtranslate')}
							</Button>
							{result && (
								<div className="gtrans-mt-3 gtrans-rounded gtrans-bg-body gtrans-p-2 gtrans-text-xs gtrans-text-label">
									<div>{__('Languages:', 'gemtranslate')} <strong>{result.languages}</strong></div>
									<div>{__('Posts:', 'gemtranslate')} <strong>{result.posts}</strong></div>
									<div>{__('Strings:', 'gemtranslate')} <strong>{result.strings}</strong></div>
									<div>{__('Skipped:', 'gemtranslate')} <strong>{result.skipped}</strong></div>
									{result.errors?.length > 0 && (
										<div className="gtrans-mt-2 gtrans-text-danger">{result.errors[0]}</div>
									)}
								</div>
							)}
						</Card>
					);
				})}
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

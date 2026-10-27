import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Field, Select } from '../../components/Input';
import { useLanguages } from '../../hooks/useLanguages';
import { usePostTypes } from '../../hooks/usePostTypes';
import { useExport, useImport } from '../../hooks/useIo';
import { formatErrorMessage } from '../../lib/format';

function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function parseFilename(headers) {
	const cd = headers?.['content-disposition'] || '';
	const m = /filename="?([^";]+)"?/i.exec(cd);
	return m ? m[1] : 'gemtranslate-export.xliff';
}

export default function ImportExportPage() {
	const langs = useLanguages();
	const postTypes = usePostTypes();
	const nonDefault = (langs.data || []).filter((l) => !l.is_default);
	const types = postTypes.data || [];

	const [exportKind, setExportKind] = useState('strings');
	const [exportLang, setExportLang] = useState(nonDefault[0]?.code || '');
	const [exportFormat, setExportFormat] = useState('xliff');
	const [exportPostType, setExportPostType] = useState('post');
	const [importKind, setImportKind] = useState('strings');
	const [importLang, setImportLang] = useState(nonDefault[0]?.code || '');
	const [importFormat, setImportFormat] = useState('xliff');
	const [fileText, setFileText] = useState('');
	const [toast, setToast] = useState(null);

	const exportMut = useExport();
	const importMut = useImport();

	const runExport = async () => {
		try {
			const result = await exportMut.mutateAsync({
				kind: exportKind,
				lang: exportLang,
				format: exportFormat,
				post_type: exportPostType,
			});
			downloadBlob(result.blob, parseFilename(result.headers));
			setToast({ tone: 'success', message: __('Export downloaded.', 'gemtranslate') });
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onFile = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => setFileText(String(reader.result || ''));
		reader.readAsText(file);
	};

	const runImport = async () => {
		if (!fileText) {
			setToast({ tone: 'error', message: __('Pick a file first.', 'gemtranslate') });
			return;
		}
		try {
			const result = await importMut.mutateAsync({
				kind: importKind,
				lang: importLang,
				format: importFormat,
				body: fileText,
			});
			setToast({
				tone: 'success',
				message: sprintf(
					/* translators: 1: saved count, 2: total units. */
					__('Imported %1$d of %2$d entries.', 'gemtranslate'),
					result.saved,
					result.units
				),
			});
		} catch (err) {
			setToast({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<>
			<PageHeader
				title={__('Import & export', 'gemtranslate')}
				description={__('Round-trip translations through XLIFF 2.1 or CSV for offline translators and translation services.', 'gemtranslate')}
			/>

			<div className="gtrans-grid gtrans-gap-6 md:gtrans-grid-cols-2">
				<Card title={__('Export', 'gemtranslate')}>
					<div className="gtrans-grid gtrans-grid-cols-2 gtrans-gap-3">
						<Field label={__('What', 'gemtranslate')}>
							<Select value={exportKind} onChange={(e) => setExportKind(e.target.value)}>
								<option value="strings">{__('UI strings', 'gemtranslate')}</option>
								<option value="posts">{__('Posts / pages', 'gemtranslate')}</option>
							</Select>
						</Field>
						<Field label={__('Language', 'gemtranslate')}>
							<Select value={exportLang} onChange={(e) => setExportLang(e.target.value)}>
								{nonDefault.map((l) => (
									<option key={l.code} value={l.code}>{l.name} ({l.code})</option>
								))}
							</Select>
						</Field>
						<Field label={__('Format', 'gemtranslate')}>
							<Select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
								<option value="xliff">XLIFF 2.1</option>
								<option value="csv">CSV</option>
							</Select>
						</Field>
						{exportKind === 'posts' && (
							<Field label={__('Post type', 'gemtranslate')}>
								<Select value={exportPostType} onChange={(e) => setExportPostType(e.target.value)}>
									{(types.length === 0 ? [{ name: 'post', label: 'Posts' }, { name: 'page', label: 'Pages' }] : types).map((t) => (
										<option key={t.name} value={t.name}>{t.label}</option>
									))}
								</Select>
							</Field>
						)}
					</div>
					<div className="gtrans-mt-4 gtrans-flex gtrans-justify-end">
						<Button onClick={runExport} loading={exportMut.isPending}>
							{__('Download', 'gemtranslate')}
						</Button>
					</div>
				</Card>

				<Card title={__('Import', 'gemtranslate')}>
					<div className="gtrans-grid gtrans-grid-cols-2 gtrans-gap-3">
						<Field label={__('What', 'gemtranslate')}>
							<Select value={importKind} onChange={(e) => setImportKind(e.target.value)}>
								<option value="strings">{__('UI strings', 'gemtranslate')}</option>
								<option value="posts">{__('Posts / pages', 'gemtranslate')}</option>
							</Select>
						</Field>
						<Field label={__('Language', 'gemtranslate')}>
							<Select value={importLang} onChange={(e) => setImportLang(e.target.value)}>
								{nonDefault.map((l) => (
									<option key={l.code} value={l.code}>{l.name} ({l.code})</option>
								))}
							</Select>
						</Field>
						<Field label={__('Format', 'gemtranslate')}>
							<Select value={importFormat} onChange={(e) => setImportFormat(e.target.value)}>
								<option value="xliff">XLIFF 2.1</option>
								<option value="csv">CSV</option>
							</Select>
						</Field>
						<Field label={__('File', 'gemtranslate')}>
							<input
								type="file"
								accept=".xliff,.xml,.csv,.txt"
								onChange={onFile}
								className="gtrans-block gtrans-w-full gtrans-text-sm"
							/>
						</Field>
					</div>
					<div className="gtrans-mt-4 gtrans-flex gtrans-justify-end">
						<Button onClick={runImport} loading={importMut.isPending} disabled={!fileText}>
							{__('Import', 'gemtranslate')}
						</Button>
					</div>
				</Card>
			</div>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</>
	);
}

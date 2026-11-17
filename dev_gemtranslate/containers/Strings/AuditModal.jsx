import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { usePackageAudit } from '../../hooks/usePackages';
import { formatErrorMessage } from '../../lib/format';

const TYPES = [
	{
		key: 'missing_domain',
		label: () => __('Missing domain', 'gemtranslate'),
		hint: () =>
			__('A translation call with no text domain, or a variable instead of a literal. WordPress cannot load translations for it.', 'gemtranslate'),
	},
	{
		key: 'wrong_domain',
		label: () => __('Wrong domain', 'gemtranslate'),
		hint: () =>
			__('The call uses a different text domain than this plugin declares, so its translations will not be found.', 'gemtranslate'),
	},
	{
		key: 'hardcoded',
		label: () => __('Likely hardcoded', 'gemtranslate'),
		hint: () =>
			__('Visible text that is not wrapped in __() or _e(). This is a best-effort guess — review each one.', 'gemtranslate'),
	},
];

const VISIBLE_ROWS = 300;

/** Save the full stored report as a .json file, entirely in the browser. */
function downloadReport(pkg, audit) {
	const report = {
		package: pkg.name,
		slug: pkg.slug,
		text_domain: audit.text_domain || pkg.text_domain,
		generated_at: new Date((audit.updated_at || Date.now() / 1000) * 1000).toISOString(),
		counts: audit.counts,
		truncated: !!audit.truncated,
		findings: audit.findings || [],
	};
	const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${pkg.slug}-translation-audit.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

/** Total issues across the three finding types. */
export function auditIssueCount(audit) {
	if (!audit) return 0;
	return (audit.missing_domain || 0) + (audit.wrong_domain || 0) + (audit.hardcoded || 0);
}

export default function AuditModal({ pkg, onClose, onStart, onRerun, running, progress }) {
	const detail = usePackageAudit(pkg.slug);
	const [type, setType] = useState('');

	const audit = detail.data;
	const counts = audit?.counts || {};
	const active = type || TYPES.find((t) => (counts[t.key] || 0) > 0)?.key || TYPES[0].key;
	const allOfType = (audit?.findings || []).filter((f) => f.type === active);
	const findings = allOfType.slice(0, VISIBLE_ROWS);
	const activeMeta = TYPES.find((t) => t.key === active);

	return (
		<Modal
			open
			onClose={onClose}
			size="lg"
			title={sprintf(
				/* translators: %s: plugin or theme name. */
				__('Translation readiness — %s', 'gemtranslate'),
				pkg.name
			)}
			subtitle={sprintf(
				/* translators: %s: text domain. */
				__('Expected text domain: %s', 'gemtranslate'),
				pkg.text_domain
			)}
			footer={
				<>
					<Button variant="secondary" disabled={!audit} onClick={() => downloadReport(pkg, audit)}>
						{__('Download JSON', 'gemtranslate')}
					</Button>
					<Button variant="secondary" loading={running} onClick={onRerun}>
						{running && progress
							? sprintf(
									/* translators: 1: files done, 2: total files. */
									__('Auditing %1$d / %2$d files…', 'gemtranslate'),
									progress.done,
									progress.total
								)
							: __('Re-run audit', 'gemtranslate')}
					</Button>
					<Button
						disabled={!onStart || !(pkg.string_count > 0)}
						title={
							pkg.string_count > 0
								? undefined
								: __('Scan this plugin first to find its strings.', 'gemtranslate')
						}
						onClick={onStart}
					>
						{__('Start translating →', 'gemtranslate')}
					</Button>
				</>
			}
		>
			{detail.isLoading && <p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('Loading…', 'gemtranslate')}</p>}
			{detail.error && <p className="gtrans-m-0 gtrans-text-sm gtrans-text-red-600">{formatErrorMessage(detail.error)}</p>}

			{audit && (
				<>
					<div className="gtrans-mb-4 gtrans-grid gtrans-grid-cols-3 gtrans-gap-3">
						{TYPES.map((t) => (
							<button
								key={t.key}
								type="button"
								onClick={() => setType(t.key)}
								className={clsx(
									'gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-bg-surface gtrans-p-3 gtrans-text-left',
									active === t.key ? 'gtrans-border-primary' : 'gtrans-border-line'
								)}
							>
								<div className="gtrans-text-2xl gtrans-font-semibold gtrans-text-ink">{counts[t.key] || 0}</div>
								<div className="gtrans-text-xs gtrans-text-muted">{t.label()}</div>
							</button>
						))}
					</div>

					<p className="gtrans-mb-3 gtrans-mt-0 gtrans-text-xs gtrans-text-muted">
						{activeMeta.hint()}{' '}
						{sprintf(
							/* translators: 1: translation calls found, 2: files scanned. */
							__('%1$d translation calls checked across %2$d files.', 'gemtranslate'),
							counts.calls || 0,
							audit.scanned_files || 0
						)}
					</p>

					{findings.length === 0 ? (
						<p className="gtrans-m-0 gtrans-py-6 gtrans-text-center gtrans-text-sm gtrans-text-muted">
							{__('Nothing found here.', 'gemtranslate')}
						</p>
					) : (
						<div className="gtrans-overflow-x-auto">
							<table className="gtrans-w-full gtrans-border-collapse gtrans-text-xs">
								<thead>
									<tr className="gtrans-text-left gtrans-text-muted">
										<th className="gtrans-py-2 gtrans-pr-3 gtrans-font-medium">{__('Location', 'gemtranslate')}</th>
										<th className="gtrans-py-2 gtrans-pr-3 gtrans-font-medium">{__('Text', 'gemtranslate')}</th>
										{active === 'wrong_domain' && (
											<th className="gtrans-py-2 gtrans-font-medium">{__('Domain used', 'gemtranslate')}</th>
										)}
									</tr>
								</thead>
								<tbody>
									{findings.map((f, i) => (
										<tr key={`${f.file}:${f.line}:${i}`} className="gtrans-border-t gtrans-border-line gtrans-align-top">
											<td className="gtrans-py-2 gtrans-pr-3 gtrans-font-mono gtrans-text-muted">
												{f.file}:{f.line}
											</td>
											<td className="gtrans-py-2 gtrans-pr-3 gtrans-text-ink">{f.text}</td>
											{active === 'wrong_domain' && (
												<td className="gtrans-py-2 gtrans-font-mono">{f.found}</td>
											)}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{allOfType.length > VISIBLE_ROWS && (
						<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-xs gtrans-text-muted">
							{sprintf(
								/* translators: 1: rows shown, 2: total rows. */
								__('Showing the first %1$d of %2$d. Download the JSON for the full list.', 'gemtranslate'),
								VISIBLE_ROWS,
								allOfType.length
							)}
						</p>
					)}

					{audit.truncated && (
						<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-xs gtrans-text-muted">
							{__('The stored list is capped at 3,000 findings; the counts above are complete.', 'gemtranslate')}
						</p>
					)}
				</>
			)}
		</Modal>
	);
}

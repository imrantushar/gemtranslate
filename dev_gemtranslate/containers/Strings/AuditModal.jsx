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

/** Total issues across the three finding types. */
export function auditIssueCount(audit) {
	if (!audit) return 0;
	return (audit.missing_domain || 0) + (audit.wrong_domain || 0) + (audit.hardcoded || 0);
}

export default function AuditModal({ pkg, onClose, onRerun, running, progress }) {
	const detail = usePackageAudit(pkg.slug);
	const [type, setType] = useState('');

	const audit = detail.data;
	const counts = audit?.counts || {};
	const active = type || TYPES.find((t) => (counts[t.key] || 0) > 0)?.key || TYPES[0].key;
	const findings = (audit?.findings || []).filter((f) => f.type === active);
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
					<Button variant="secondary" onClick={onClose}>
						{__('Close', 'gemtranslate')}
					</Button>
					<Button loading={running} onClick={onRerun}>
						{running && progress
							? sprintf(
									/* translators: 1: files done, 2: total files. */
									__('Auditing %1$d / %2$d files…', 'gemtranslate'),
									progress.done,
									progress.total
								)
							: __('Re-run audit', 'gemtranslate')}
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

					{audit.truncated && (
						<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-xs gtrans-text-muted">
							{__('The list is capped; the counts above are complete.', 'gemtranslate')}
						</p>
					)}
				</>
			)}
		</Modal>
	);
}

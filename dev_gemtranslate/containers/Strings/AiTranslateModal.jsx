import { useCallback, useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { Select } from '../../components/ui/Select';
import { TextArea } from '../../components/Input';
import { fetchUntranslated, useCsvImport } from '../../hooks/usePackages';
import { buildCsv, buildPrompt, copyText, downloadText } from '../../lib/aiTranslate';
import { formatErrorMessage } from '../../lib/format';

const BATCH_SIZES = [100, 200, 300, 500];

// The select menu is portalled to <body>; lift it above the modal overlay.
const modalSelectStyles = {
	menuPortal: (base) => ({ ...base, zIndex: 100001 }),
};

const ISSUE_LABELS = {
	placeholder_mismatch: () => __('Rejected — placeholder or HTML tag was lost', 'gemtranslate'),
	unknown_id: () => __('Skipped — id does not belong to this plugin', 'gemtranslate'),
	empty: () => __('Skipped — no translation given', 'gemtranslate'),
	already_translated: () => __('Skipped — already translated (tick "overwrite" to replace)', 'gemtranslate'),
	unchanged: () => __('Imported, but identical to the source — check these', 'gemtranslate'),
};

const STEPS = [
	{ n: 1, label: () => __('Copy', 'gemtranslate'), hint: () => __('Prompt + strings', 'gemtranslate') },
	{ n: 2, label: () => __('Paste', 'gemtranslate'), hint: () => __("AI's answer", 'gemtranslate') },
	{ n: 3, label: () => __('Import', 'gemtranslate'), hint: () => __('Review & save', 'gemtranslate') },
];

function Check() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

/** Numbered progress bar. Finished steps can be clicked to go back. */
function Stepper({ step, reached, onGo }) {
	return (
		<ol className="gtrans-m-0 gtrans-mb-6 gtrans-flex gtrans-list-none gtrans-items-start gtrans-p-0">
			{STEPS.map((s, i) => {
				const done = s.n < step;
				const current = s.n === step;
				const clickable = s.n <= reached && !current;
				return (
					<li key={s.n} className={clsx('gtrans-flex gtrans-items-start', i < STEPS.length - 1 && 'gtrans-flex-1')}>
						<button
							type="button"
							disabled={!clickable}
							onClick={() => onGo(s.n)}
							aria-current={current ? 'step' : undefined}
							className={clsx(
								'gtrans-bare gtrans-flex gtrans-flex-col gtrans-items-center gtrans-gap-1 gtrans-border-0 gtrans-bg-transparent gtrans-p-0',
								clickable ? 'gtrans-cursor-pointer' : 'gtrans-cursor-default'
							)}
						>
							<span
								className={clsx(
									'gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-border-2 gtrans-border-solid gtrans-text-sm gtrans-font-semibold gtrans-transition-colors',
									done && 'gtrans-border-primary gtrans-bg-primary gtrans-text-white',
									current && 'gtrans-border-primary gtrans-bg-surface gtrans-text-primary',
									!done && !current && 'gtrans-border-line gtrans-bg-surface gtrans-text-muted'
								)}
							>
								{done ? <Check /> : s.n}
							</span>
							<span className={clsx('gtrans-text-sm gtrans-font-medium', current ? 'gtrans-text-ink' : 'gtrans-text-label')}>
								{s.label()}
							</span>
							<span className="gtrans-text-11 gtrans-text-muted">{s.hint()}</span>
						</button>
						{i < STEPS.length - 1 && (
							<span
								className={clsx(
									'gtrans-mx-3 gtrans-mt-4 gtrans-h-0.5 gtrans-flex-1 gtrans-rounded',
									done ? 'gtrans-bg-primary' : 'gtrans-bg-line'
								)}
								aria-hidden="true"
							/>
						)}
					</li>
				);
			})}
		</ol>
	);
}

/**
 * Translate one plugin/theme with an external AI model, as a three-step wizard:
 * copy a prompt + CSV of its untranslated strings, paste the model's CSV back,
 * review the check and import. Works in batches so each chat stays within the
 * model's limits.
 */
export default function AiTranslateModal({ pkg, lang, langRow, sourceName, onClose, onNotify }) {
	const [step, setStep] = useState(1);
	const [reached, setReached] = useState(1);
	const [batch, setBatch] = useState(200);
	// How many untranslated strings have already been handed out (copied or
	// downloaded) and are waiting for the AI's answer. The next batch starts here.
	const [offset, setOffset] = useState(0);
	const [remaining, setRemaining] = useState(null);
	const [handedOut, setHandedOut] = useState(null); // { from, to } of the last copy
	const [busy, setBusy] = useState('');
	const [csv, setCsv] = useState('');
	const [overwrite, setOverwrite] = useState(false);
	const [report, setReport] = useState(null);
	const [imported, setImported] = useState(null); // saved count after a successful import
	const importer = useCsvImport();

	const targetName = langRow?.name || lang;
	const prompt = buildPrompt({
		sourceName,
		targetName,
		targetCode: lang,
		pluginName: pkg.name,
	});

	const goTo = (n) => {
		setStep(n);
		setReached((r) => Math.max(r, n));
	};

	const refresh = useCallback(async () => {
		try {
			const { total } = await fetchUntranslated({ domain: pkg.text_domain, lang, limit: 1 });
			setRemaining(total);
		} catch (err) {
			setRemaining(null);
		}
	}, [pkg.text_domain, lang]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const nextBatch = async () => {
		const { rows, total } = await fetchUntranslated({ domain: pkg.text_domain, lang, limit: offset + batch });
		setRemaining(total);
		return rows.slice(offset);
	};

	const run = async (key, fn) => {
		setBusy(key);
		try {
			await fn();
		} catch (err) {
			onNotify({ tone: 'error', message: formatErrorMessage(err) });
		} finally {
			setBusy('');
		}
	};

	const handOut = (rows) => {
		setHandedOut({ from: offset + 1, to: offset + rows.length });
		setOffset((o) => o + rows.length);
	};

	const onCopyAll = () =>
		run('copy', async () => {
			const rows = await nextBatch();
			if (!rows.length) {
				onNotify({ tone: 'success', message: __('Nothing left to translate.', 'gemtranslate') });
				return;
			}
			await copyText(`${prompt}\n${buildCsv(rows)}`);
			handOut(rows);
		});

	const onCopyPrompt = () =>
		run('prompt', async () => {
			await copyText(prompt);
			onNotify({ tone: 'success', message: __('Prompt copied.', 'gemtranslate') });
		});

	const onDownload = () =>
		run('download', async () => {
			const rows = await nextBatch();
			if (!rows.length) {
				onNotify({ tone: 'success', message: __('Nothing left to translate.', 'gemtranslate') });
				return;
			}
			downloadText(buildCsv(rows), `${pkg.slug}-${lang}-to-translate-${offset + 1}-${offset + rows.length}.csv`);
			handOut(rows);
		});

	const onFile = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			setCsv(String(reader.result || ''));
			setReport(null);
		};
		reader.readAsText(file);
		e.target.value = '';
	};

	const onCheck = async () => {
		try {
			setReport(await importer.mutateAsync({ slug: pkg.slug, lang, csv, overwrite, commit: false }));
			goTo(3);
		} catch (err) {
			setReport(null);
			onNotify({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onImport = async () => {
		try {
			const result = await importer.mutateAsync({ slug: pkg.slug, lang, csv, overwrite, commit: true });
			setImported(result.saved);
			setCsv('');
			setReport(null);
			// Imported strings leave the untranslated list, so the next batch
			// moves up by the same amount.
			setOffset((o) => Math.max(0, o - result.saved));
			refresh();
		} catch (err) {
			onNotify({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	const onAnotherBatch = () => {
		setImported(null);
		setReached(1);
		setStep(1);
	};

	const ready = report?.counts?.ready || 0;
	const allHandedOut = remaining !== null && offset >= remaining;
	const finished = imported !== null;

	// ---- Footer: Back on the left, the step's main action on the right. ----
	let footer;
	if (finished) {
		footer = (
			<div className="gtrans-flex gtrans-w-full gtrans-items-center gtrans-justify-between gtrans-gap-3">
				<Button variant="secondary" onClick={onClose}>
					{__('Close', 'gemtranslate')}
				</Button>
				{remaining > 0 && (
					<Button onClick={onAnotherBatch}>{__('Translate the next batch', 'gemtranslate')}</Button>
				)}
			</div>
		);
	} else if (step === 1) {
		footer = (
			<div className="gtrans-flex gtrans-w-full gtrans-items-center gtrans-justify-between gtrans-gap-3">
				<Button variant="secondary" onClick={onClose}>
					{__('Close', 'gemtranslate')}
				</Button>
				<Button onClick={() => goTo(2)}>{__('Next: paste the answer →', 'gemtranslate')}</Button>
			</div>
		);
	} else if (step === 2) {
		footer = (
			<div className="gtrans-flex gtrans-w-full gtrans-items-center gtrans-justify-between gtrans-gap-3">
				<Button variant="secondary" onClick={() => setStep(1)}>
					{__('← Back', 'gemtranslate')}
				</Button>
				<Button loading={importer.isPending} disabled={!csv.trim()} onClick={onCheck}>
					{__('Check →', 'gemtranslate')}
				</Button>
			</div>
		);
	} else {
		footer = (
			<div className="gtrans-flex gtrans-w-full gtrans-items-center gtrans-justify-between gtrans-gap-3">
				<Button variant="secondary" onClick={() => setStep(2)}>
					{__('← Back', 'gemtranslate')}
				</Button>
				<Button loading={importer.isPending} disabled={ready === 0} onClick={onImport}>
					{sprintf(
						/* translators: %d: number of translations to import. */
						_n('Import %d translation', 'Import %d translations', ready, 'gemtranslate'),
						ready
					)}
				</Button>
			</div>
		);
	}

	return (
		<Modal
			open
			onClose={onClose}
			size="lg"
			title={sprintf(
				/* translators: 1: plugin name, 2: language name. */
				__('Translate %1$s into %2$s with AI', 'gemtranslate'),
				pkg.name,
				targetName
			)}
			subtitle={
				remaining === null
					? undefined
					: sprintf(
							/* translators: %d: untranslated string count. */
							_n('%d string still untranslated', '%d strings still untranslated', remaining, 'gemtranslate'),
							remaining
						)
			}
			footer={footer}
		>
			<Stepper step={finished ? 4 : step} reached={finished ? 3 : reached} onGo={goTo} />

			{finished && (
				<div className="gtrans-py-6 gtrans-text-center">
					<span className="gtrans-mx-auto gtrans-mb-3 gtrans-flex gtrans-h-12 gtrans-w-12 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-bg-emerald-100 gtrans-text-emerald-700">
						<Check />
					</span>
					<h4 className="gtrans-m-0 gtrans-text-base gtrans-font-semibold gtrans-text-ink">
						{sprintf(
							/* translators: %d: number of translations saved. */
							_n('Imported %d translation', 'Imported %d translations', imported, 'gemtranslate'),
							imported
						)}
					</h4>
					<p className="gtrans-mb-0 gtrans-mt-1 gtrans-text-sm gtrans-text-muted">
						{remaining > 0
							? sprintf(
									/* translators: %d: untranslated string count. */
									_n('%d string is still untranslated.', '%d strings are still untranslated.', remaining, 'gemtranslate'),
									remaining
								)
							: __('Every string is translated.', 'gemtranslate')}
					</p>
				</div>
			)}

			{/* ---- Step 1: copy ---- */}
			{!finished && step === 1 && (
				<div>
					<p className="gtrans-m-0 gtrans-mb-4 gtrans-text-sm gtrans-text-label">
						{__('Copy the prompt together with a batch of strings, then paste it into ChatGPT, Claude or Gemini.', 'gemtranslate')}
					</p>

					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
						<label className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-text-label">
							{__('Strings per batch', 'gemtranslate')}
							<Select styles={modalSelectStyles} value={batch} onChange={(e) => setBatch(Number(e.target.value))}>
								{BATCH_SIZES.map((n) => (
									<option key={n} value={n}>{n}</option>
								))}
							</Select>
						</label>
						<Button loading={busy === 'copy'} onClick={onCopyAll} disabled={allHandedOut}>
							{__('Copy prompt + CSV', 'gemtranslate')}
						</Button>
						<Button variant="secondary" loading={busy === 'download'} onClick={onDownload} disabled={allHandedOut}>
							{__('Download CSV', 'gemtranslate')}
						</Button>
						<Button variant="ghost" loading={busy === 'prompt'} onClick={onCopyPrompt}>
							{__('Copy prompt only', 'gemtranslate')}
						</Button>
					</div>

					{handedOut && (
						<p className="gtrans-mb-0 gtrans-mt-4 gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-rounded gtrans-bg-emerald-50 gtrans-px-3 gtrans-py-2 gtrans-text-sm gtrans-text-emerald-800">
							<Check />
							{sprintf(
								/* translators: 1: first string number, 2: last string number. */
								__('Strings %1$d–%2$d are ready to paste into your AI model.', 'gemtranslate'),
								handedOut.from,
								handedOut.to
							)}
						</p>
					)}

					{remaining !== null && remaining > 0 && (
						<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-sm gtrans-text-ink">
							{allHandedOut
								? __('All strings have been copied. Continue to paste the AI answers.', 'gemtranslate')
								: Math.min(offset + batch, remaining) === offset + 1
									? sprintf(
											/* translators: 1: string number, 2: total untranslated. */
											__('Next batch: string %1$d of %2$d.', 'gemtranslate'),
											offset + 1,
											remaining
										)
									: sprintf(
											/* translators: 1: first string number, 2: last string number, 3: total untranslated. */
											__('Next batch: strings %1$d–%2$d of %3$d.', 'gemtranslate'),
											offset + 1,
											Math.min(offset + batch, remaining),
											remaining
										)}
							{offset > 0 && (
								<>
									{' '}
									<button
										type="button"
										onClick={() => {
											setOffset(0);
											setHandedOut(null);
										}}
										className="gtrans-bare gtrans-cursor-pointer gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-text-primary hover:gtrans-underline"
									>
										{__('Start from the first string', 'gemtranslate')}
									</button>
								</>
							)}
						</p>
					)}

					<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-xs gtrans-text-muted">
						{__('Each copy moves on to the next batch automatically, so you can copy several batches before importing. Your strings are sent to whichever AI service you choose.', 'gemtranslate')}
					</p>
				</div>
			)}

			{/* ---- Step 2: paste ---- */}
			{!finished && step === 2 && (
				<div>
					<p className="gtrans-m-0 gtrans-mb-3 gtrans-text-sm gtrans-text-label">
						{__('Paste the CSV the AI returned, or upload it as a file. Extra text around the CSV is ignored.', 'gemtranslate')}
					</p>
					<TextArea
						rows={9}
						value={csv}
						placeholder={'id,source,context,target\n12,"Save changes",,"…"'}
						onChange={(e) => {
							setCsv(e.target.value);
							setReport(null);
						}}
					/>
					<div className="gtrans-mt-3 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-text-sm">
						<label className="gtrans-cursor-pointer gtrans-text-primary">
							{__('…or upload a CSV file', 'gemtranslate')}
							<input type="file" accept=".csv,.txt" onChange={onFile} className="gtrans-hidden" />
						</label>
						<label className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-label">
							<input
								type="checkbox"
								checked={overwrite}
								onChange={(e) => {
									setOverwrite(e.target.checked);
									setReport(null);
								}}
							/>
							{__('Overwrite existing translations', 'gemtranslate')}
						</label>
					</div>
				</div>
			)}

			{/* ---- Step 3: review ---- */}
			{!finished && step === 3 && report && (
				<div>
					<p className="gtrans-m-0 gtrans-mb-4 gtrans-text-sm gtrans-text-ink">
						{sprintf(
							/* translators: 1: ready count, 2: total rows read. */
							__('%1$d of %2$d rows are ready to import.', 'gemtranslate'),
							ready,
							report.counts.rows
						)}
					</p>

					{Object.keys(ISSUE_LABELS).map((type) => {
						const count = report.counts[type] || 0;
						if (!count) return null;
						return (
							<details key={type} className="gtrans-mb-2 gtrans-rounded gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-2 gtrans-text-xs">
								<summary className="gtrans-cursor-pointer gtrans-text-label">
									<strong>{count}</strong> · {ISSUE_LABELS[type]()}
								</summary>
								<ul className="gtrans-m-0 gtrans-mt-2 gtrans-list-none gtrans-p-0">
									{(report.issues[type] || []).map((it, i) => (
										<li key={`${it.id}-${i}`} className="gtrans-border-t gtrans-border-line gtrans-py-1.5">
											<div className="gtrans-text-muted">#{it.id} {it.source}</div>
											{it.target && <div className="gtrans-text-ink">{it.target}</div>}
											{it.detail && <div className="gtrans-font-mono gtrans-text-red-600">{__('Lost:', 'gemtranslate')} {it.detail}</div>}
										</li>
									))}
									{count > (report.issues[type] || []).length && (
										<li className="gtrans-pt-1.5 gtrans-text-muted">
											{sprintf(
												/* translators: %d: number of rows not listed. */
												__('…and %d more', 'gemtranslate'),
												count - (report.issues[type] || []).length
											)}
										</li>
									)}
								</ul>
							</details>
						);
					})}

					{ready === 0 && (
						<p className="gtrans-mb-0 gtrans-mt-3 gtrans-text-sm gtrans-text-red-600">
							{__('Nothing can be imported. Go back and check the pasted CSV.', 'gemtranslate')}
						</p>
					)}
				</div>
			)}
		</Modal>
	);
}

import { useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';

import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { Select } from '../../components/ui/Select';
import { TextArea } from '../../components/Input';
import {
	buildItemsCsv,
	buildPagePrompt,
	copyText,
	downloadText,
	lostTokens,
	parseAiCsv,
} from '../../lib/aiTranslate';
import { formatErrorMessage } from '../../lib/format';
import { useLanguages } from '../../hooks/useLanguages';

const BATCH_SIZES = [50, 100, 200, 300];

const modalSelectStyles = {
	menuPortal: (base) => ({ ...base, zIndex: 100001 }),
};

const ISSUE_LABELS = {
	placeholder_mismatch: () => __('Rejected — a placeholder or HTML tag was lost', 'gemtranslate'),
	unknown_id: () => __('Skipped — id is not part of this page', 'gemtranslate'),
	empty: () => __('Skipped — no translation given', 'gemtranslate'),
	already_translated: () => __('Skipped — already translated (tick "overwrite" to replace)', 'gemtranslate'),
	unchanged: () => __('Applied, but identical to the source — check these', 'gemtranslate'),
};

const clip = (s) => {
	const t = String(s || '').replace(/\s+/g, ' ').trim();
	return t.length > 100 ? `${t.slice(0, 97)}…` : t;
};

/**
 * Toolbar button + modal for an editor. Resolves language names from codes so
 * the editors only pass what they already have.
 */
export function PageAiButton({ items, drafts, pageTitle, slug, sourceLang, targetLang, onApply, onNotify }) {
	const [open, setOpen] = useState(false);
	const languages = useLanguages();
	const list = languages.data || [];
	const nameOf = (code) => list.find((l) => l.code === code)?.name || code;

	return (
		<>
			<Button type="button" variant="secondary" size="sm" disabled={items.length === 0} onClick={() => setOpen(true)}>
				{__('Translate with AI', 'gemtranslate')}
			</Button>
			{open && (
				<PageAiModal
					items={items}
					drafts={drafts}
					pageTitle={pageTitle}
					slug={slug}
					sourceName={nameOf(sourceLang)}
					targetName={nameOf(targetLang)}
					targetCode={targetLang}
					onApply={onApply}
					onClose={() => setOpen(false)}
					onNotify={onNotify}
				/>
			)}
		</>
	);
}

/**
 * Translate one page/post with an external AI model: copy a prompt + CSV of
 * its untranslated strings, paste the model's CSV back, review the check, then
 * apply. Applying only fills the editor's drafts — the translator still reviews
 * and presses the editor's own Save, so nothing is written to the database here.
 *
 * `items` are the editor's rows: { key, source, context }. `drafts` maps key to
 * the current translation. `onApply` receives { [key]: translation }.
 */
export default function PageAiModal({
	items,
	drafts,
	pageTitle,
	sourceName,
	targetName,
	targetCode,
	slug,
	onApply,
	onClose,
	onNotify,
}) {
	const [batch, setBatch] = useState(100);
	const [handedOut, setHandedOut] = useState(0);
	const [busy, setBusy] = useState('');
	const [csv, setCsv] = useState('');
	const [overwrite, setOverwrite] = useState(false);
	const [report, setReport] = useState(null);
	const [applied, setApplied] = useState(null);

	// A row's id is its 1-based position on the page, so it never depends on
	// what the modal did earlier: a CSV copied before closing the modal, or
	// before other batches were applied, still matches when it is pasted back.
	const idOf = (item) => items.indexOf(item) + 1;
	const itemById = (id) => items[id - 1];

	const todo = useMemo(
		() => items.filter((it) => (drafts[it.key] ?? '').trim() === '' && it.source.trim() !== ''),
		[items, drafts]
	);
	const allHandedOut = handedOut >= todo.length;

	const prompt = buildPagePrompt({ sourceName, targetName, targetCode, pageTitle });

	const nextRows = () =>
		todo.slice(handedOut, handedOut + batch).map((it) => ({ ...it, id: idOf(it) }));

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

	const onCopyAll = () =>
		run('copy', async () => {
			const rows = nextRows();
			if (!rows.length) return;
			await copyText(`${prompt}\n${buildItemsCsv(rows)}`);
			setHandedOut((n) => n + rows.length);
			onNotify({ tone: 'success', message: __('Prompt and strings copied. Paste them into your AI model.', 'gemtranslate') });
		});

	const onDownload = () =>
		run('download', async () => {
			const rows = nextRows();
			if (!rows.length) return;
			downloadText(buildItemsCsv(rows), `${slug || 'page'}-${targetCode}-to-translate.csv`);
			setHandedOut((n) => n + rows.length);
		});

	const onCopyPrompt = () =>
		run('prompt', async () => {
			await copyText(prompt);
			onNotify({ tone: 'success', message: __('Prompt copied.', 'gemtranslate') });
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

	const onCheck = () => {
		const rows = parseAiCsv(csv);
		const counts = { rows: rows.length, ready: 0, empty: 0, unknown_id: 0, already_translated: 0, placeholder_mismatch: 0, unchanged: 0 };
		const issues = { empty: [], unknown_id: [], already_translated: [], placeholder_mismatch: [], unchanged: [] };
		const valid = {};
		const note = (type, row, source, detail = '') => {
			counts[type]++;
			if (issues[type].length < 50) {
				issues[type].push({ id: row.id, source: clip(source), target: clip(row.target), detail });
			}
		};

		rows.forEach((row) => {
			const item = itemById(row.id);
			if (!item) return note('unknown_id', row, row.source);
			if (!row.target) return note('empty', row, item.source);
			if (!overwrite && (drafts[item.key] ?? '').trim() !== '') return note('already_translated', row, item.source);
			const lost = lostTokens(item.source, row.target);
			if (lost.length) return note('placeholder_mismatch', row, item.source, lost.join(' '));
			if (row.target === item.source && /\p{L}{4,}/u.test(item.source)) note('unchanged', row, item.source);
			valid[item.key] = row.target;
			counts.ready++;
		});

		setReport({ counts, issues, valid });
	};

	const onApplyClick = () => {
		const n = report.counts.ready;
		onApply(report.valid);
		setApplied(n);
		setCsv('');
		setReport(null);
		// Applied strings leave the untranslated list, so the next batch moves up.
		setHandedOut((h) => Math.max(0, h - n));
	};

	const ready = report?.counts?.ready || 0;

	const footer = applied !== null ? (
		<div className="gtrans-flex gtrans-w-full gtrans-items-center gtrans-justify-between gtrans-gap-3">
			<Button onClick={onClose}>{__('Done — review and save', 'gemtranslate')}</Button>
			{todo.length > 0 && (
				<Button variant="secondary" onClick={() => setApplied(null)}>
					{__('Translate the next batch', 'gemtranslate')}
				</Button>
			)}
		</div>
	) : (
		<div className="gtrans-flex gtrans-w-full gtrans-items-center gtrans-justify-between gtrans-gap-3">
			<Button variant="secondary" onClick={onClose}>{__('Close', 'gemtranslate')}</Button>
			{report ? (
				<Button disabled={ready === 0} onClick={onApplyClick}>
					{sprintf(
						/* translators: %d: number of translations to apply. */
						_n('Apply %d translation', 'Apply %d translations', ready, 'gemtranslate'),
						ready
					)}
				</Button>
			) : (
				<Button disabled={!csv.trim()} onClick={onCheck}>{__('Check answer →', 'gemtranslate')}</Button>
			)}
		</div>
	);

	return (
		<Modal
			open
			onClose={onClose}
			size="lg"
			title={sprintf(
				/* translators: 1: page title, 2: language name. */
				__('Translate “%1$s” into %2$s with AI', 'gemtranslate'),
				pageTitle,
				targetName
			)}
			subtitle={sprintf(
				/* translators: %d: untranslated string count. */
				_n('%d string still untranslated', '%d strings still untranslated', todo.length, 'gemtranslate'),
				todo.length
			)}
			footer={footer}
		>
			{applied !== null ? (
				<div className="gtrans-py-6 gtrans-text-center">
					<h4 className="gtrans-m-0 gtrans-text-base gtrans-font-semibold gtrans-text-ink">
						{sprintf(
							/* translators: %d: number of translations filled in. */
							_n('%d translation filled in', '%d translations filled in', applied, 'gemtranslate'),
							applied
						)}
					</h4>
					<p className="gtrans-mb-0 gtrans-mt-1 gtrans-text-sm gtrans-text-muted">
						{__('They are not saved yet. Review them in the editor, then press Save.', 'gemtranslate')}
					</p>
				</div>
			) : todo.length === 0 && !csv ? (
				<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">
					{__('Every string on this page already has a translation.', 'gemtranslate')}
				</p>
			) : (
				<div className="gtrans-flex gtrans-flex-col gtrans-gap-5">
					<section>
						<h4 className="gtrans-m-0 gtrans-mb-2 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
							{__('1. Copy the prompt and strings', 'gemtranslate')}
						</h4>
						<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-3">
							<label className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-text-label">
								{__('Strings per batch', 'gemtranslate')}
								<Select styles={modalSelectStyles} value={batch} onChange={(e) => setBatch(Number(e.target.value))}>
									{BATCH_SIZES.map((n) => (
										<option key={n} value={n}>{n}</option>
									))}
								</Select>
							</label>
							<Button loading={busy === 'copy'} disabled={allHandedOut} onClick={onCopyAll}>
								{__('Copy prompt + CSV', 'gemtranslate')}
							</Button>
							<Button variant="secondary" loading={busy === 'download'} disabled={allHandedOut} onClick={onDownload}>
								{__('Download CSV', 'gemtranslate')}
							</Button>
							<Button variant="ghost" loading={busy === 'prompt'} onClick={onCopyPrompt}>
								{__('Copy prompt only', 'gemtranslate')}
							</Button>
						</div>
						<p className="gtrans-mb-0 gtrans-mt-2 gtrans-text-xs gtrans-text-muted">
							{allHandedOut
								? __('All strings have been copied. Paste the AI answers below.', 'gemtranslate')
								: sprintf(
										/* translators: 1: first string number, 2: last string number, 3: total untranslated. */
										__('Next batch: strings %1$d–%2$d of %3$d. Your text is sent to whichever AI service you choose.', 'gemtranslate'),
										handedOut + 1,
										Math.min(handedOut + batch, todo.length),
										todo.length
									)}
						</p>
					</section>

					<section>
						<h4 className="gtrans-m-0 gtrans-mb-2 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
							{__('2. Paste the AI’s answer', 'gemtranslate')}
						</h4>
						<TextArea
							rows={7}
							value={csv}
							placeholder={'id,source,context,target\n1,"Welcome to {1}our site{2}",heading,"…"'}
							onChange={(e) => {
								setCsv(e.target.value);
								setReport(null);
							}}
						/>
						<div className="gtrans-mt-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3 gtrans-text-sm">
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
					</section>

					{report && (
						<section>
							<h4 className="gtrans-m-0 gtrans-mb-2 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
								{sprintf(
									/* translators: 1: ready count, 2: total rows read. */
									__('3. Check: %1$d of %2$d rows are ready', 'gemtranslate'),
									ready,
									report.counts.rows
								)}
							</h4>
							{Object.keys(ISSUE_LABELS).map((type) => {
								const count = report.counts[type] || 0;
								if (!count) return null;
								const list = report.issues[type] || [];
								return (
									<details key={type} className="gtrans-mb-2 gtrans-rounded gtrans-border gtrans-border-line gtrans-px-3 gtrans-py-2 gtrans-text-xs">
										<summary className="gtrans-cursor-pointer gtrans-text-label">
											<strong>{count}</strong> · {ISSUE_LABELS[type]()}
										</summary>
										<ul className="gtrans-m-0 gtrans-mt-2 gtrans-list-none gtrans-p-0">
											{list.map((it, i) => (
												<li key={`${it.id}-${i}`} className="gtrans-border-t gtrans-border-line gtrans-py-1.5">
													<div className="gtrans-text-muted">#{it.id} {it.source}</div>
													{it.target && <div className="gtrans-text-ink">{it.target}</div>}
													{it.detail && (
														<div className="gtrans-font-mono gtrans-text-red-600">
															{__('Lost:', 'gemtranslate')} {it.detail}
														</div>
													)}
												</li>
											))}
											{count > list.length && (
												<li className="gtrans-pt-1.5 gtrans-text-muted">
													{sprintf(
														/* translators: %d: number of rows not listed. */
														__('…and %d more', 'gemtranslate'),
														count - list.length
													)}
												</li>
											)}
										</ul>
									</details>
								);
							})}
							{ready === 0 && (
								<p className="gtrans-mb-0 gtrans-mt-2 gtrans-text-sm gtrans-text-red-600">
									{__('Nothing can be applied. Check the pasted CSV.', 'gemtranslate')}
								</p>
							)}
						</section>
					)}
				</div>
			)}
		</Modal>
	);
}

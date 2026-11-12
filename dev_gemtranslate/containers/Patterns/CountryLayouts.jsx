import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';

import Card from '../../components/Card';
import Button from '../../components/Button';
import { TextInput } from '../../components/Input';
import { Select } from '../../components/ui/Select';
import { usePatternVariants, useSavePatternVariants } from '../../hooks/usePatterns';
import { formatErrorMessage } from '../../lib/format';
import { canManage } from '../../lib/currentUser';

const EMPTY_RULE = { country: '', lang: '', use: '' };

/**
 * Show visitors from a country a different template part, e.g. `footer-ca`
 * instead of `footer`. The alternate part is built in the Site Editor (it keeps
 * its own blocks) and is translated like any other template part.
 */
export default function CountryLayouts({ part, title, languages, onNotify }) {
	const variants = usePatternVariants(part);
	const save = useSavePatternVariants();
	const [rules, setRules] = useState([]);
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		setRules((variants.data?.rules || []).map((r) => ({ ...r })));
		setDirty(false);
	}, [variants.data]);

	if (!variants.data) return null;
	const choices = variants.data.choices;

	const change = (i, patch) => {
		setRules((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
		setDirty(true);
	};
	const remove = (i) => {
		setRules((rs) => rs.filter((_, n) => n !== i));
		setDirty(true);
	};

	const submit = async () => {
		try {
			const stored = await save.mutateAsync({
				part,
				rules: rules.filter((r) => (r.country || r.lang) && r.use),
			});
			onNotify({
				tone: 'success',
				message: sprintf(
					/* translators: %d: number of country layouts. */
					_n('Saved %d country layout.', 'Saved %d country layouts.', (stored || []).length, 'gemtranslate'),
					(stored || []).length
				),
			});
		} catch (err) {
			onNotify({ tone: 'error', message: formatErrorMessage(err) });
		}
	};

	return (
		<Card
			title={sprintf(/* translators: %s: template part name. */ __('Country layouts · %s', 'gemtranslate'), title)}
			className="gtrans-mt-4"
		>
			<p className="gtrans-mb-3 gtrans-mt-0 gtrans-text-xs gtrans-text-muted">
				{__(
					'Show visitors from a country a different template part. Build it in the Site Editor (Appearance → Editor → Patterns → Template parts), then pick it here. Needs country detection to be turned on in Settings.',
					'gemtranslate'
				)}
			</p>

			{rules.length === 0 && (
				<p className="gtrans-mb-3 gtrans-mt-0 gtrans-text-sm gtrans-text-muted">
					{__('Every visitor sees the default layout.', 'gemtranslate')}
				</p>
			)}

			{rules.length > 0 && (
				<div className="gtrans-flex gtrans-flex-col gtrans-gap-2">
					<div className="gtrans-grid gtrans-grid-cols-[90px_minmax(140px,1fr)_minmax(180px,1fr)_90px] gtrans-gap-3 gtrans-px-1 gtrans-text-xs gtrans-font-semibold gtrans-text-label">
						<span>{__('Country', 'gemtranslate')}</span>
						<span>{__('Language', 'gemtranslate')}</span>
						<span>{__('Shows this template part', 'gemtranslate')}</span>
						<span />
					</div>
					{rules.map((rule, i) => (
						<div key={i} className="gtrans-grid gtrans-grid-cols-[90px_minmax(140px,1fr)_minmax(180px,1fr)_90px] gtrans-items-center gtrans-gap-3">
							<TextInput
								className="gtrans-uppercase"
								maxLength={2}
								value={rule.country}
								placeholder={__('Any', 'gemtranslate')}
								aria-label={__('Country code', 'gemtranslate')}
								onChange={(e) => change(i, { country: e.target.value.toUpperCase() })}
							/>
							<Select
								aria-label={__('Language', 'gemtranslate')}
								value={rule.lang}
								onChange={(e) => change(i, { lang: e.target.value })}
							>
								<option value="">{__('Any language', 'gemtranslate')}</option>
								{languages.map((l) => (
									<option key={l.code} value={l.code}>{l.name}</option>
								))}
							</Select>
							<Select
								aria-label={__('Template part', 'gemtranslate')}
								value={rule.use}
								onChange={(e) => change(i, { use: e.target.value })}
							>
								<option value="">{__('Choose a template part…', 'gemtranslate')}</option>
								{choices.map((c) => (
									<option key={c.id} value={c.id}>{c.title}</option>
								))}
							</Select>
							<Button size="sm" variant="ghost" onClick={() => remove(i)}>
								{__('Remove', 'gemtranslate')}
							</Button>
						</div>
					))}
				</div>
			)}

			<div className="gtrans-mt-4 gtrans-flex gtrans-items-center gtrans-gap-2">
				<Button size="sm" variant="secondary" onClick={() => { setRules((rs) => [...rs, { ...EMPTY_RULE }]); setDirty(true); }}>
					{__('+ Add country layout', 'gemtranslate')}
				</Button>
				{canManage ? (
					<Button size="sm" loading={save.isPending} disabled={!dirty} onClick={submit}>
						{__('Save layouts', 'gemtranslate')}
					</Button>
				) : (
					<span className="gtrans-text-xs gtrans-text-muted">{__('Only administrators can change layouts.', 'gemtranslate')}</span>
				)}
			</div>
		</Card>
	);
}

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { __, sprintf } from '@wordpress/i18n';

import Button from './Button';
import StatusPill from './StatusPill';
import Toast from './Toast';
import { Field, TextInput } from './Input';

/**
 * The StoreEngine SDK's payload for GemTranslate Pro.
 *
 * The SDK localizes it onto the admin script when Pro registers its licensing
 * client (`SE_SDK_` + the slug, upper-cased). It is absent when Pro is not
 * active, which is how Settings knows whether to show the License tab.
 */
export const sdk = window.SE_SDK_GEMTRANSLATE_PRO || null;

const client = sdk?.rest_url
	? axios.create({ baseURL: sdk.rest_url, headers: { 'X-WP-Nonce': sdk.nonce || '' } })
	: null;

const get = async (path) => (await client.get(path)).data;
const post = async (path, body = {}) => (await client.post(path, body)).data;

/** -1, 0 or 1, comparing dotted version numbers part by part. */
function compareVersions(a, b) {
	const left = String(a).split(/[.-]/);
	const right = String(b).split(/[.-]/);
	for (let i = 0; i < Math.max(left.length, right.length); i++) {
		const x = parseInt(left[i], 10) || 0;
		const y = parseInt(right[i], 10) || 0;
		if (x !== y) return x < y ? -1 : 1;
	}
	return 0;
}

const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

function formatDate(value) {
	if (!value) return '';
	// The SDK sends either a unix timestamp or a MySQL datetime.
	const date = new Date(/^\d+$/.test(String(value)) ? Number(value) * 1000 : String(value).replace(' ', 'T'));
	return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function Stat({ label, children }) {
	return (
		<div>
			<p className="gtrans-m-0 gtrans-text-xs gtrans-font-medium gtrans-uppercase gtrans-text-muted">{label}</p>
			<div className="gtrans-mt-1 gtrans-text-sm gtrans-text-ink">{children}</div>
		</div>
	);
}

/**
 * Licence and updates for GemTranslate Pro. Talks to the SDK's own REST
 * routes; nothing here is stored by GemTranslate.
 */
export default function License() {
	const [license, setLicense] = useState(sdk?.license || {});
	const [update, setUpdate] = useState(null);
	const [key, setKey] = useState('');
	const [busy, setBusy] = useState('');
	const [versions, setVersions] = useState(null);
	const [versionsError, setVersionsError] = useState('');
	const [toast, setToast] = useState(null);

	const active = 'active' === license?.status;
	const installed = update?.current_version || sdk?.package?.version || '0';

	const refresh = useCallback(async () => {
		if (!client) return;
		try {
			setLicense(await get('license/status'));
		} catch (e) {
			// Keep what the page loaded with.
		}
		try {
			setUpdate(await get('updates/status'));
		} catch (e) {
			setUpdate(null);
		}
	}, []);

	const loadVersions = useCallback(async () => {
		if (!client) return;
		setVersionsError('');
		try {
			const result = await get('updates/versions');
			setVersions(result?.versions || []);
		} catch (e) {
			setVersions([]);
			setVersionsError(errorMessage(e, __('Could not load the version history.', 'gemtranslate')));
		}
	}, []);

	useEffect(() => {
		refresh();
		loadVersions();
	}, [refresh, loadVersions]);

	const run = async (name, task) => {
		setBusy(name);
		try {
			await task();
		} catch (e) {
			setToast({ tone: 'error', message: errorMessage(e, __('Something went wrong. Try again.', 'gemtranslate')) });
		} finally {
			setBusy('');
		}
	};

	const activate = () =>
		run('activate', async () => {
			if (!key.trim()) {
				setToast({ tone: 'error', message: __('Enter your license key first.', 'gemtranslate') });
				return;
			}
			const result = await post('license/activate', { license: key.trim() });
			setLicense(result?.license || result);
			setKey('');
			setToast({ tone: 'success', message: __('License activated.', 'gemtranslate') });
			refresh();
		});

	const deactivate = () =>
		run('deactivate', async () => {
			const result = await post('license/deactivate');
			setLicense(result?.license || result);
			setToast({ tone: 'success', message: __('License deactivated.', 'gemtranslate') });
		});

	const check = () =>
		run('check', async () => {
			const result = await post('updates/check-now');
			setUpdate(result);
			setToast({
				tone: 'success',
				message: result?.update_available
					? /* translators: %s: version number. */ sprintf(__('Version %s is available.', 'gemtranslate'), result.latest_version)
					: __('You are up to date.', 'gemtranslate'),
			});
		});

	const install = (version) =>
		run('install:' + version.version, async () => {
			const downgrade = compareVersions(version.version, installed) < 0;
			const message = version.breaking_changes
				? /* translators: %s: what changes. */ sprintf(__('This version has breaking changes: %s', 'gemtranslate'), version.breaking_changes)
				: /* translators: %s: version number. */ sprintf(
						__('GemTranslate Pro will be replaced with version %s. The page reloads when it is done.', 'gemtranslate'),
						version.version
				  );
			// eslint-disable-next-line no-alert
			if (!window.confirm(message)) return;
			const result = await post('updates/install', { version: version.version });
			setToast({
				tone: 'success',
				message: /* translators: %s: version number. */ sprintf(__('Now on version %s. Reloading…', 'gemtranslate'), result?.target_version || version.version),
			});
			setTimeout(() => window.location.reload(), 1500);
		});

	if (!client) {
		return (
			<p className="gtrans-m-0 gtrans-py-4 gtrans-text-sm gtrans-text-muted">
				{__('Activate GemTranslate Pro to manage its license here.', 'gemtranslate')}
			</p>
		);
	}

	const expires = formatDate(license?.expires);
	const checked = formatDate(update?.last_checked_at);

	return (
		<div className="gtrans-flex gtrans-flex-col gtrans-gap-8 gtrans-py-4">
			<section>
				<div className="gtrans-flex gtrans-items-center gtrans-justify-between">
					<h3 className="gtrans-m-0 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">{__('Updates', 'gemtranslate')}</h3>
					<Button onClick={check} loading={'check' === busy}>
						{__('Check for updates', 'gemtranslate')}
					</Button>
				</div>
				<div className="gtrans-mt-4 gtrans-flex gtrans-flex-wrap gtrans-gap-x-10 gtrans-gap-y-4">
					<Stat label={__('Installed', 'gemtranslate')}>{update?.current_version || sdk.package?.version || '—'}</Stat>
					<Stat label={__('Latest', 'gemtranslate')}>
						{update?.latest_version || '—'}{' '}
						{update?.update_available && <StatusPill tone="draft">{__('Update available', 'gemtranslate')}</StatusPill>}
					</Stat>
					{checked && <Stat label={__('Last checked', 'gemtranslate')}>{checked}</Stat>}
				</div>
			</section>

			<section>
				<div className="gtrans-flex gtrans-items-center gtrans-justify-between">
					<h3 className="gtrans-m-0 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">{__('License', 'gemtranslate')}</h3>
					<StatusPill tone={active ? 'publish' : 'none'}>{active ? __('Active', 'gemtranslate') : __('Not activated', 'gemtranslate')}</StatusPill>
				</div>
				{active ? (
					<div className="gtrans-mt-4 gtrans-flex gtrans-flex-col gtrans-gap-4">
						<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-x-10 gtrans-gap-y-4">
							<Stat label={__('Key', 'gemtranslate')}>
								<span className="gtrans-break-all gtrans-font-mono">{license?.license || '—'}</span>
							</Stat>
							<Stat label={__('Sites', 'gemtranslate')}>
								{license?.unlimited
									? __('Unlimited', 'gemtranslate')
									: /* translators: 1: sites in use, 2: sites allowed. */ sprintf(__('%1$s of %2$s in use', 'gemtranslate'), license?.activations ?? 0, license?.limit ?? 1)}
							</Stat>
							<Stat label={__('Expires', 'gemtranslate')}>{expires || __('Never', 'gemtranslate')}</Stat>
						</div>
						<div>
							<Button variant="danger" onClick={deactivate} loading={'deactivate' === busy}>
								{__('Deactivate on this site', 'gemtranslate')}
							</Button>
						</div>
					</div>
				) : (
					<form
						className="gtrans-mt-4 gtrans-flex gtrans-flex-col gtrans-gap-4"
						onSubmit={(e) => {
							e.preventDefault();
							activate();
						}}
					>
						<Field label={__('License key', 'gemtranslate')} hint={__('Find it in your Kodezen store dashboard.', 'gemtranslate')}>
							<TextInput
								value={key}
								onChange={(e) => setKey(e.target.value)}
								placeholder={__('Paste your license key', 'gemtranslate')}
								autoComplete="off"
								spellCheck={false}
							/>
						</Field>
						<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-4">
							<Button type="submit" loading={'activate' === busy}>
								{__('Activate license', 'gemtranslate')}
							</Button>
							{(sdk.purchase_url || sdk.store_dashboard_url) && (
								<a className="gtrans-text-sm" href={sdk.purchase_url || sdk.store_dashboard_url} target="_blank" rel="noreferrer">
									{__('Don’t have a key? Get one', 'gemtranslate')}
								</a>
							)}
						</div>
					</form>
				)}
			</section>

			<section>
				<h3 className="gtrans-m-0 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">{__('Version history', 'gemtranslate')}</h3>
				<p className="gtrans-mb-3 gtrans-mt-1 gtrans-text-xs gtrans-text-muted">
					{__('Install a release or roll back to an earlier one.', 'gemtranslate')}
				</p>
				{null === versions && <p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('Loading…', 'gemtranslate')}</p>}
				{versionsError && <p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{versionsError}</p>}
				{versions && !versionsError && 0 === versions.length && (
					<p className="gtrans-m-0 gtrans-text-sm gtrans-text-muted">{__('No other versions are available yet.', 'gemtranslate')}</p>
				)}
				{versions && versions.length > 0 && (
					<table className="gtrans-w-full gtrans-border-collapse gtrans-text-left gtrans-text-sm">
						<thead>
							<tr className="gtrans-border-b gtrans-border-divider gtrans-text-xs gtrans-uppercase gtrans-text-muted">
								<th className="gtrans-py-2 gtrans-font-medium">{__('Version', 'gemtranslate')}</th>
								<th className="gtrans-py-2 gtrans-font-medium">{__('Status', 'gemtranslate')}</th>
								<th className="gtrans-py-2 gtrans-font-medium">{__('Released', 'gemtranslate')}</th>
								<th className="gtrans-py-2" />
							</tr>
						</thead>
						<tbody>
							{versions.map((version) => {
								const downgrade = compareVersions(version.version, installed) < 0;
								return (
									<tr key={version.id || version.version} className="gtrans-border-b gtrans-border-divider">
										<td className="gtrans-py-2 gtrans-font-mono gtrans-text-ink">
											{version.version} {version.is_current && <StatusPill tone="pending">{__('Current', 'gemtranslate')}</StatusPill>}
										</td>
										<td className="gtrans-py-2 gtrans-text-muted">{version.status || '—'}</td>
										<td className="gtrans-py-2 gtrans-text-muted">{formatDate(version.deployed_at) || '—'}</td>
										<td className="gtrans-py-2 gtrans-text-right">
											{version.is_current ? (
												<span className="gtrans-text-xs gtrans-text-muted">{__('Installed', 'gemtranslate')}</span>
											) : downgrade && !version.allow_rollback ? (
												<span className="gtrans-text-xs gtrans-text-muted">{__('Rollback blocked', 'gemtranslate')}</span>
											) : (
												<Button
													size="xs"
													variant="secondary"
													onClick={() => install(version)}
													loading={'install:' + version.version === busy}
													disabled={busy.startsWith('install:')}
												>
													{downgrade ? __('Roll back', 'gemtranslate') : __('Install', 'gemtranslate')}
												</Button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</section>

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</div>
	);
}

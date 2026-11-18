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
			if (!client) {
				setToast({
					tone: 'error',
					message: __(
						'Licensing isn’t live yet — the Pro product is still being published on the store. Keep your key safe; this form will activate it as soon as it’s available.',
						'gemtranslate'
					),
				});
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
			if (!client) {
				setToast({ tone: 'error', message: __('Updates aren’t live yet.', 'gemtranslate') });
				return;
			}
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

	// Nothing to render if Pro isn't installed at all — the Settings tab is
	// already hidden in that case, but guard against a stale window global.
	if (!sdk) {
		return (
			<p className="gtrans-m-0 gtrans-py-4 gtrans-text-sm gtrans-text-muted">
				{__('Activate GemTranslate Pro to manage its license here.', 'gemtranslate')}
			</p>
		);
	}

	const pending = !client;

	const expires = formatDate(license?.expires);
	const checked = formatDate(update?.last_checked_at);
	const latest = update?.latest_version;
	const updateAvailable = !!update?.update_available;

	// ----------------------------------------------------------------
	// Shared card primitives — the storeengine-pro license panel's
	// visual language: soft-shadow card, divider header, roomy body.
	// ----------------------------------------------------------------
	const cardClass =
		'gtrans-mb-6 gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-shadow-sm';
	const cardHeaderClass =
		'gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-4 gtrans-border-b gtrans-border-divider gtrans-bg-body gtrans-px-6 gtrans-py-4';
	const cardTitleClass = 'gtrans-m-0 gtrans-text-base gtrans-font-semibold gtrans-text-ink';
	const cardSubtitleClass = 'gtrans-mb-0 gtrans-mt-1 gtrans-text-xs gtrans-text-muted';
	const cardBodyClass = 'gtrans-px-6 gtrans-py-6';

	const VersionBlock = ({ label, value, highlight }) => (
		<div className="gtrans-flex gtrans-min-w-[96px] gtrans-flex-col gtrans-gap-1">
			<span className="gtrans-text-[11px] gtrans-font-medium gtrans-uppercase gtrans-tracking-wider gtrans-text-muted">
				{label}
			</span>
			<span
				className={`gtrans-font-mono gtrans-text-2xl gtrans-font-semibold gtrans-tabular-nums ${
					highlight ? 'gtrans-text-primary' : 'gtrans-text-ink'
				}`}
			>
				{value || '—'}
			</span>
		</div>
	);

	return (
		<div className="gtrans-py-4">
			{pending && (
				<div className="gtrans-mb-6 gtrans-rounded-md gtrans-border gtrans-border-amber-200 gtrans-bg-amber-50 gtrans-px-4 gtrans-py-3 gtrans-text-sm gtrans-text-amber-900">
					<p className="gtrans-m-0">
						{__(
							'Pro licensing is being set up — the GemTranslate Pro product is still being published on the store. You can keep your license key below and it will activate as soon as the service is live.',
							'gemtranslate'
						)}{' '}
						{sdk.purchase_url && (
							<a href={sdk.purchase_url} target="_blank" rel="noreferrer">
								{__('Open the store', 'gemtranslate')}
							</a>
						)}
					</p>
				</div>
			)}

			{/* -------------------------------------------------- */}
			{/* Updates card — hero with Installed → Latest */}
			{/* -------------------------------------------------- */}
			<div className={cardClass}>
				<div className={cardHeaderClass}>
					<div>
						<h3 className={cardTitleClass}>{__('Updates', 'gemtranslate')}</h3>
						<p className={cardSubtitleClass}>
							{__('Check for new releases of GemTranslate Pro.', 'gemtranslate')}
						</p>
					</div>
					<div className="gtrans-flex gtrans-items-center gtrans-gap-4">
						{checked && (
							<span className="gtrans-text-xs gtrans-text-muted">
								{/* translators: %s: date string. */ sprintf(__('Last checked %s', 'gemtranslate'), checked)}
							</span>
						)}
						<Button variant="secondary" onClick={check} loading={'check' === busy}>
							{__('Check for updates', 'gemtranslate')}
						</Button>
					</div>
				</div>
				<div className={cardBodyClass}>
					<div className="gtrans-flex gtrans-flex-wrap gtrans-items-end gtrans-gap-7">
						<VersionBlock label={__('Installed', 'gemtranslate')} value={installed} />
						{updateAvailable && (
							<span aria-hidden="true" className="gtrans-text-3xl gtrans-leading-none gtrans-text-line">
								→
							</span>
						)}
						{updateAvailable && (
							<VersionBlock label={__('Latest', 'gemtranslate')} value={latest} highlight />
						)}
						{!updateAvailable && latest && (
							<VersionBlock label={__('Latest', 'gemtranslate')} value={latest} />
						)}
						{updateAvailable && (
							<div className="gtrans-ml-auto">
								<StatusPill tone="draft">{__('Update available', 'gemtranslate')}</StatusPill>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* -------------------------------------------------- */}
			{/* License card */}
			{/* -------------------------------------------------- */}
			<div className={cardClass}>
				<div className={cardHeaderClass}>
					<div>
						<h3 className={cardTitleClass}>{__('License', 'gemtranslate')}</h3>
						<p className={cardSubtitleClass}>
							{active
								? __('Your site is activated and receiving updates.', 'gemtranslate')
								: __('Activate your license key to enable updates and support.', 'gemtranslate')}
						</p>
					</div>
					<StatusPill tone={active ? 'publish' : 'none'}>
						{active ? __('Active', 'gemtranslate') : __('Not activated', 'gemtranslate')}
					</StatusPill>
				</div>
				<div className={cardBodyClass}>
					{active ? (
						<div className="gtrans-flex gtrans-flex-col gtrans-gap-6">
							<div className="gtrans-grid gtrans-grid-cols-1 gtrans-gap-x-10 gtrans-gap-y-4 md:gtrans-grid-cols-2 lg:gtrans-grid-cols-4">
								<Stat label={__('Key', 'gemtranslate')}>
									<span className="gtrans-break-all gtrans-font-mono gtrans-text-xs">
										{license?.license || '—'}
									</span>
								</Stat>
								<Stat label={__('Sites', 'gemtranslate')}>
									{license?.unlimited
										? __('Unlimited', 'gemtranslate')
										: /* translators: 1: sites in use, 2: sites allowed. */ sprintf(
												__('%1$s of %2$s in use', 'gemtranslate'),
												license?.activations ?? 0,
												license?.limit ?? 1
										  )}
								</Stat>
								<Stat label={__('Expires', 'gemtranslate')}>{expires || __('Never', 'gemtranslate')}</Stat>
								<Stat label={__('Automatic updates', 'gemtranslate')}>
									{__('Enabled', 'gemtranslate')}
								</Stat>
							</div>
							<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-4 gtrans-border-t gtrans-border-divider gtrans-pt-5">
								<Button variant="danger" onClick={deactivate} loading={'deactivate' === busy}>
									{__('Deactivate on this site', 'gemtranslate')}
								</Button>
								{sdk.store_dashboard_url && (
									<a
										className="gtrans-text-sm"
										href={sdk.store_dashboard_url}
										target="_blank"
										rel="noreferrer"
									>
										{__('Manage license on store →', 'gemtranslate')}
									</a>
								)}
							</div>
						</div>
					) : (
						<form
							className="gtrans-flex gtrans-flex-col gtrans-gap-5"
							onSubmit={(e) => {
								e.preventDefault();
								activate();
							}}
						>
							<Field
								label={__('License key', 'gemtranslate')}
								hint={__('Find it in your Kodezen store dashboard, under License keys.', 'gemtranslate')}
							>
								<TextInput
									value={key}
									onChange={(e) => setKey(e.target.value)}
									placeholder={__('Enter your license key to activate', 'gemtranslate')}
									autoComplete="off"
									spellCheck={false}
								/>
							</Field>
							<div className="gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-4">
								<Button type="submit" loading={'activate' === busy}>
									{__('Activate license', 'gemtranslate')}
								</Button>
								{sdk.store_dashboard_url && (
									<a
										className="gtrans-text-sm"
										href={sdk.store_dashboard_url}
										target="_blank"
										rel="noreferrer"
									>
										{__('Manage license', 'gemtranslate')}
									</a>
								)}
							</div>
							{sdk.purchase_url && (
								<p className="gtrans-mb-0 gtrans-mt-2 gtrans-text-sm gtrans-text-muted">
									{__('Don’t have a license key?', 'gemtranslate')}{' '}
									<a href={sdk.purchase_url} target="_blank" rel="noreferrer">
										{__('Purchase one here', 'gemtranslate')}
									</a>
								</p>
							)}
						</form>
					)}
				</div>
			</div>

			{/* -------------------------------------------------- */}
			{/* Version history card — only once the SDK is live. */}
			{/* -------------------------------------------------- */}
			{!pending && (
			<div className={cardClass}>
				<div className={cardHeaderClass}>
					<div>
						<h3 className={cardTitleClass}>{__('Version history', 'gemtranslate')}</h3>
						<p className={cardSubtitleClass}>
							{__('Install a release or roll back to an earlier one.', 'gemtranslate')}
						</p>
					</div>
				</div>
				<div className={cardBodyClass}>
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
				</div>
			</div>
			)}

			<Toast message={toast?.message} tone={toast?.tone} onClear={() => setToast(null)} />
		</div>
	);
}

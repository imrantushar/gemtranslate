import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/edit-post';
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { Button, PanelBody, Spinner } from '@wordpress/components';
import { useCallback, useEffect, useState } from '@wordpress/element';

import './editor.css';

const config = window.gtrans || {};

async function api(path, init = {}) {
	const url = config.root + path.replace(/^\//, '');
	const res = await fetch(url, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': config.nonce || '',
			...(init.headers || {}),
		},
		...init,
	});
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(body?.message || res.statusText);
	}
	return body?.data ?? body;
}

function GemTranslateSidebar() {
	const postId = useSelect((s) => s('core/editor').getCurrentPostId(), []);
	const [languages, setLanguages] = useState([]);
	const [statuses, setStatuses] = useState({});
	const [busy, setBusy] = useState({});
	const [error, setError] = useState(null);

	const refresh = useCallback(async () => {
		if (!postId) return;
		try {
			const langs = await api('languages?active=true');
			setLanguages(langs);
			const translations = await api(`posts/${postId}/translations`);
			const map = {};
			(translations?.translations || []).forEach((t) => {
				map[t.language.code] = t.translation?.status || null;
			});
			setStatuses(map);
		} catch (err) {
			setError(err.message);
		}
	}, [postId]);

	useEffect(() => { refresh(); }, [refresh]);

	const queueTranslate = async (langCode) => {
		setBusy((b) => ({ ...b, [langCode]: true }));
		try {
			await api('jobs', {
				method: 'POST',
				body: JSON.stringify({
					post_id: postId,
					target_lang: langCode,
					options: { use_memory: true, preserve_html: true, overwrite: false },
				}),
			});
			setStatuses((s) => ({ ...s, [langCode]: 'queued' }));
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy((b) => ({ ...b, [langCode]: false }));
		}
	};

	const nonDefault = languages.filter((l) => !l.is_default);

	return (
		<PluginSidebar name="gemtranslate-sidebar" title={__('GemTranslate', 'gemtranslate')} icon="translation">
			<PanelBody title={__('Translation status', 'gemtranslate')} initialOpen={true}>
				{error && <p style={{ color: '#dc2626' }}>{error}</p>}
				{languages.length === 0 ? (
					<p>
						<Spinner /> {__('Loading languages…', 'gemtranslate')}
					</p>
				) : nonDefault.length === 0 ? (
					<p>{__('Add a non-default language in GemTranslate to start translating.', 'gemtranslate')}</p>
				) : (
					<table style={{ width: '100%', fontSize: 12 }}>
						<tbody>
							{nonDefault.map((l) => {
								const status = statuses[l.code];
								const isBusy = busy[l.code];
								return (
									<tr key={l.code}>
										<td style={{ paddingBottom: 6 }}>
											<strong>{l.name}</strong>
											<div style={{ color: '#6b7280' }}>{l.code}</div>
										</td>
										<td style={{ paddingBottom: 6 }}>
											<span style={{ padding: '2px 6px', borderRadius: 999, background: status ? '#dcfce7' : '#f3f4f6', color: status ? '#166534' : '#6b7280' }}>
												{status || __('—', 'gemtranslate')}
											</span>
										</td>
										<td style={{ paddingBottom: 6, textAlign: 'right' }}>
											<div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
												<Button
													size="small"
													variant="secondary"
													isBusy={isBusy}
													onClick={() => queueTranslate(l.code)}
												>
													{__('AI', 'gemtranslate')}
												</Button>
												<Button
													size="small"
													href={`${config.adminUrl}admin.php?page=gemtranslate#/posts/${postId}`}
													target="_blank"
												>
													{__('Edit', 'gemtranslate')}
												</Button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
				<p style={{ marginTop: 12 }}>
					<Button variant="link" onClick={refresh}>
						{__('Refresh', 'gemtranslate')}
					</Button>
				</p>
				<p style={{ fontSize: 11, color: '#6b7280' }}>
					{__('AI queues a background job. Progress is visible in GemTranslate → Jobs.', 'gemtranslate')}
				</p>
			</PanelBody>
		</PluginSidebar>
	);
}

function GemTranslateMoreItem() {
	return (
		<PluginSidebarMoreMenuItem target="gemtranslate-sidebar" icon="translation">
			{__('GemTranslate', 'gemtranslate')}
		</PluginSidebarMoreMenuItem>
	);
}

registerPlugin('gemtranslate-editor', {
	render: () => (
		<>
			<GemTranslateMoreItem />
			<GemTranslateSidebar />
		</>
	),
});

import { __ } from '@wordpress/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '../lib/api';
import { useLanguages } from '../hooks/useLanguages';

function useMyLanguage() {
	return useQuery({
		queryKey: ['me', 'language'],
		queryFn: async () => unwrap(await api.get('me/language')),
	});
}

function useSetMyLanguage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (language) => unwrap(await api.put('me/language', { language })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'language'] }),
	});
}

/**
 * A compact admin-UI language switcher. Saving updates the user's
 * `gtrans_preferred_language` meta and reloads so WordPress picks up the
 * new locale.
 */
export default function LanguagePicker() {
	const languages = useLanguages();
	const me = useMyLanguage();
	const setMine = useSetMyLanguage();

	if (languages.isLoading) return null;
	const langs = languages.data || [];
	if (langs.length <= 1) return null;

	const current = me.data?.language || '';

	const onChange = async (e) => {
		const value = e.target.value;
		await setMine.mutateAsync(value);
		// Reload so the new locale activates immediately.
		window.location.reload();
	};

	return (
		<div className="ztrans-rounded-md ztrans-bg-ztrans-bg ztrans-px-3 ztrans-py-2">
			<label className="ztrans-block">
				<span className="ztrans-block ztrans-text-xs ztrans-font-medium ztrans-text-ztrans-muted">
					{__('Admin UI language', 'gemtranslate')}
				</span>
				<select
					value={current}
					onChange={onChange}
					disabled={setMine.isPending}
					className="ztrans-mt-1 ztrans-w-full ztrans-rounded ztrans-border ztrans-border-ztrans-border ztrans-bg-white ztrans-px-2 ztrans-py-1 ztrans-text-sm"
				>
					<option value="">{__('Site default', 'gemtranslate')}</option>
					{langs.map((lang) => (
						<option key={lang.code} value={lang.code}>
							{lang.name} ({lang.code})
						</option>
					))}
				</select>
			</label>
			<p className="ztrans-mt-1 ztrans-mb-0 ztrans-text-[11px] ztrans-leading-snug ztrans-text-ztrans-muted">
				{__('Changes the admin interface only. Frontend visitors pick their own language via the switcher.', 'gemtranslate')}
			</p>
		</div>
	);
}

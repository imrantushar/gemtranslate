import { __ } from '@wordpress/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '../lib/api';
import { useLanguages } from '../hooks/useLanguages';
import { Select } from './ui/Select';

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
		<div className="gtrans-rounded-md gtrans-bg-body gtrans-px-3 gtrans-py-2">
			<label className="gtrans-block">
				<span className="gtrans-block gtrans-text-xs gtrans-font-medium gtrans-text-muted">
					{__('Admin UI language', 'gemtranslate')}
				</span>
				<Select
					value={current}
					onChange={onChange}
					disabled={setMine.isPending}
					className="gtrans-mt-1 gtrans-w-full"
				>
					<option value="">{__('Site default', 'gemtranslate')}</option>
					{langs.map((lang) => (
						<option key={lang.code} value={lang.code}>
							{lang.name} ({lang.code})
						</option>
					))}
				</Select>
			</label>
			<p className="gtrans-mt-1 gtrans-mb-0 gtrans-text-[11px] gtrans-leading-snug gtrans-text-muted">
				{__('Changes the admin interface only. Frontend visitors pick their own language via the switcher.', 'gemtranslate')}
			</p>
		</div>
	);
}

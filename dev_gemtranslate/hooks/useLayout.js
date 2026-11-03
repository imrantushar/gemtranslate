import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function useLayoutItems(lang, country = '') {
	return useQuery({
		queryKey: ['layout', 'items', lang, country],
		queryFn: async () => {
			const res = await api.get('layout/items', { params: { lang, country } });
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
		enabled: !!lang,
	});
}

export function useLayoutUnits(id, lang, country = '') {
	return useQuery({
		queryKey: ['layout', 'units', id, lang, country],
		queryFn: async () => unwrap(await api.get(`layout/units/${lang}`, { params: { id, country } })) || [],
		enabled: !!id && !!lang,
	});
}

/** Save a batch of { source, translation } for one language (and optional country). */
export function useSaveLayoutTranslations() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ lang, country = '', units }) =>
			unwrap(await api.put(`layout/translations/${lang}`, { country, units })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['layout'] }),
	});
}

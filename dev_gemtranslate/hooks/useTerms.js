import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function useTerms(params = {}) {
	return useQuery({
		queryKey: ['terms', params],
		queryFn: async () => {
			const res = await api.get('terms', { params });
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
	});
}

export function useTermTranslations(termId) {
	return useQuery({
		queryKey: ['terms', termId, 'translations'],
		queryFn: async () => unwrap(await api.get(`terms/${termId}/translations`)),
		enabled: !!termId,
	});
}

export function useSaveTermTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ termId, lang, payload }) =>
			unwrap(await api.put(`terms/${termId}/translations/${lang}`, payload)),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['terms', vars.termId, 'translations'] });
			qc.invalidateQueries({ queryKey: ['terms'] });
		},
	});
}

export function useDeleteTermTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ termId, lang }) => unwrap(await api.delete(`terms/${termId}/translations/${lang}`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['terms'] }),
	});
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function useStrings(params = {}) {
	return useQuery({
		queryKey: ['strings', params],
		queryFn: async () => {
			const res = await api.get('strings', { params });
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
	});
}

export function useStringDomains() {
	return useQuery({
		queryKey: ['strings', 'domains'],
		queryFn: async () => unwrap(await api.get('strings/domains')) || [],
	});
}

export function useSaveStringTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, lang, value, status }) =>
			unwrap(await api.put(`strings/${id}/translations/${lang}`, { value, status })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
	});
}

export function useScanStrings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (params) => unwrap(await api.post('strings/scan', params)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
	});
}

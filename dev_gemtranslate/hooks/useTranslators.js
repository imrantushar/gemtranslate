import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useTranslators() {
	return useQuery({
		queryKey: ['translators'],
		queryFn: async () => unwrap(await api.get('translators')) || [],
	});
}

export function useSaveTranslatorLanguages() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ userId, languages }) => unwrap(await api.put(`translators/${userId}/languages`, { languages })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['translators'] }),
	});
}

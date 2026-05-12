import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useTranslationPacks() {
	return useQuery({
		queryKey: ['i18n', 'packs'],
		queryFn: async () => unwrap(await api.get('i18n/packs')),
	});
}

export function useGenerateTranslationPack() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ target_lang, locale }) => unwrap(await api.post('i18n/packs', { target_lang, locale })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['i18n', 'packs'] }),
	});
}

export function useDeleteTranslationPack() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (locale) => unwrap(await api.delete(`i18n/packs/${locale}`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['i18n', 'packs'] }),
	});
}

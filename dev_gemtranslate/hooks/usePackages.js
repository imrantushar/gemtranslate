import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function usePackages() {
	return useQuery({
		queryKey: ['strings', 'packages'],
		queryFn: async () => {
			const res = await api.get('strings/packages');
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
	});
}

export function useScanPackage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ slug }) => unwrap(await api.post(`strings/packages/${slug}/scan`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
	});
}

export function useExportPackage() {
	return useMutation({
		mutationFn: async ({ slug, lang, exclude_status = '' }) =>
			unwrap(
				await api.post(`strings/packages/${slug}/${lang}/export`, {
					exclude_status,
				})
			),
	});
}

export function useBulkSaveStrings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ translations }) =>
			unwrap(await api.patch('strings/bulk', { translations })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
	});
}

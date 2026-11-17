import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

const KEY = ['languages'];

export function useLanguages(options = {}) {
	return useQuery({
		queryKey: [...KEY, options],
		queryFn: async () => {
			const res = await api.get('languages', { params: options });
			return unwrap(res) || [];
		},
	});
}

export function useCreateLanguage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.post('languages', payload)),
		onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
	});
}

export function useUpdateLanguage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ code, ...rest }) => unwrap(await api.patch(`languages/${code}`, rest)),
		onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
	});
}

export function useDeleteLanguage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (code) => unwrap(await api.delete(`languages/${code}`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
	});
}

export function useSetDefaultLanguage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (code) => unwrap(await api.post(`languages/${code}/default`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
	});
}

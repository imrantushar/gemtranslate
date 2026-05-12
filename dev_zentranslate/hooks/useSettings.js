import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useSettings() {
	return useQuery({
		queryKey: ['settings'],
		queryFn: async () => unwrap(await api.get('settings')),
	});
}

export function useSaveSettings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.put('settings', payload)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
	});
}

export function useStats() {
	return useQuery({
		queryKey: ['stats'],
		queryFn: async () => unwrap(await api.get('stats')),
	});
}

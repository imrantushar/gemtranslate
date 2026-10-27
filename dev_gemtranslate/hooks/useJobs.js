import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function useJobs(params = {}) {
	return useQuery({
		queryKey: ['jobs', params],
		queryFn: async () => {
			const res = await api.get('jobs', { params });
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
		refetchInterval: (q) => {
			// Poll while there's anything pending or running.
			const rows = q.state.data?.rows || [];
			const live = rows.some((r) => r.status === 'pending' || r.status === 'running');
			return live ? 3000 : false;
		},
	});
}

export function useJobCounts() {
	return useQuery({
		queryKey: ['jobs', 'counts'],
		queryFn: async () => unwrap(await api.get('jobs/counts')),
		refetchInterval: 5000,
	});
}

export function useBulkTranslate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.post('jobs/bulk-translate', payload)),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['jobs'] });
			qc.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

export function useRetryJob() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id) => unwrap(await api.post(`jobs/${id}/retry`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
	});
}

export function useDeleteJob() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id) => unwrap(await api.delete(`jobs/${id}`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
	});
}

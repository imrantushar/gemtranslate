import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, getMeta } from '../lib/api';
import { hasFeature } from './useFeatures';

export function useAssignments(params = {}) {
	return useQuery({
		queryKey: ['assignments', params],
		queryFn: async () => {
			const res = await api.get('assignments', { params });
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
		keepPreviousData: true,
	});
}

export function useAssignmentCounts() {
	return useQuery({
		queryKey: ['assignments', 'counts'],
		queryFn: async () => unwrap(await api.get('assignments/counts')),
		enabled: hasFeature('translators'),
		refetchInterval: 30000,
	});
}

export function useCreateAssignment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.post('assignments', payload)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
	});
}

export function useUpdateAssignment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, status }) => unwrap(await api.patch(`assignments/${id}`, { status })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
	});
}

export function useDeleteAssignment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id) => unwrap(await api.delete(`assignments/${id}`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
	});
}

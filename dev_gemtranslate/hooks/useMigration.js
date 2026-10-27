import { useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useMigrationDetect() {
	return useQuery({
		queryKey: ['migration', 'detect'],
		queryFn: async () => unwrap(await api.get('migration/detect')),
	});
}

export function useRunMigration() {
	return useMutation({
		mutationFn: async (source) => unwrap(await api.post('migration/import', { source })),
	});
}

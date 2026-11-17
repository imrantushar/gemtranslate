import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function usePostTypes() {
	return useQuery({
		queryKey: ['post-types'],
		queryFn: async () => unwrap(await api.get('post-types')) || [],
		staleTime: 5 * 60 * 1000,
	});
}

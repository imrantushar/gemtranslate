import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function usePostBlocks(postId, lang) {
	return useQuery({
		queryKey: ['posts', postId, 'blocks', lang],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/blocks/${lang}`)),
		enabled: !!postId && !!lang,
	});
}

export function useSavePostBlocks() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, fields }) =>
			unwrap(await api.put(`posts/${postId}/blocks/${lang}`, { fields })),
		onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['posts', vars.postId, 'blocks', vars.lang] }),
	});
}

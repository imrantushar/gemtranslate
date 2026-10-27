import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function usePostMetaFields(postId, lang) {
	return useQuery({
		queryKey: ['posts', postId, 'meta', lang],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/meta-translations/${lang}`)) || [],
		enabled: !!postId && !!lang,
	});
}

export function useSavePostMeta() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, fields }) =>
			unwrap(await api.put(`posts/${postId}/meta-translations/${lang}`, { fields })),
		onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['posts', vars.postId, 'meta', vars.lang] }),
	});
}

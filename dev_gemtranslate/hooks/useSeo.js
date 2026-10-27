import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function usePostSeo(postId, lang) {
	return useQuery({
		queryKey: ['seo', postId, lang],
		queryFn: async () => unwrap(await api.get(`seo/posts/${postId}/${lang}`)),
		enabled: !!postId && !!lang,
	});
}

export function useSavePostSeo() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, payload }) =>
			unwrap(await api.put(`seo/posts/${postId}/${lang}`, payload)),
		onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['seo', vars.postId, vars.lang] }),
	});
}

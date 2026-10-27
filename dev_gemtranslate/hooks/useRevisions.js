import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useRevisions(postId, lang) {
	return useQuery({
		queryKey: ['posts', postId, 'translations', lang, 'revisions'],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/translations/${lang}/revisions`)) || [],
		enabled: !!postId && !!lang,
	});
}

export function useRevision(postId, lang, revisionId) {
	return useQuery({
		queryKey: ['posts', postId, 'translations', lang, 'revisions', revisionId],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/translations/${lang}/revisions/${revisionId}`)),
		enabled: !!postId && !!lang && !!revisionId,
	});
}

export function useRevertRevision() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, revisionId }) =>
			unwrap(await api.post(`posts/${postId}/translations/${lang}/revisions/${revisionId}/revert`)),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', vars.postId, 'translations'] });
			qc.invalidateQueries({ queryKey: ['posts', vars.postId, 'translations', vars.lang, 'revisions'] });
		},
	});
}

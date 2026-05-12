import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function usePosts(params = {}) {
	return useQuery({
		queryKey: ['posts', params],
		queryFn: async () => {
			const res = await api.get('posts', { params });
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
	});
}

export function usePostTranslations(postId) {
	return useQuery({
		queryKey: ['posts', postId, 'translations'],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/translations`)),
		enabled: !!postId,
	});
}

export function useSaveTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, payload }) =>
			unwrap(await api.put(`posts/${postId}/translations/${lang}`, payload)),
		onSuccess: (_data, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', vars.postId, 'translations'] });
			qc.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

export function useDeleteTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang }) => unwrap(await api.delete(`posts/${postId}/translations/${lang}`)),
		onSuccess: (_data, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', vars.postId, 'translations'] });
			qc.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

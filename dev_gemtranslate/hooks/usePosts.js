import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

// Normalize postId to string in every queryKey. useParams() returns strings;
// API rows return numbers. Without this, invalidateQueries() silently misses
// and the UI only updates on a hard reload.
const pid = (postId) => String(postId);

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
		queryKey: ['posts', pid(postId), 'translations'],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/translations`)),
		enabled: !!postId,
	});
}

export function useSaveTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, payload, country = '' }) => {
			const config = country ? { params: { country } } : undefined;
			return unwrap(await api.put(`posts/${postId}/translations/${lang}`, payload, config));
		},
		onSuccess: (_data, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

export function useDeleteTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang }) => unwrap(await api.delete(`posts/${postId}/translations/${lang}`)),
		onSuccess: (_data, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

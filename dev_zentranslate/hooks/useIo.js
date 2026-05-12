import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useExport() {
	return useMutation({
		mutationFn: async ({ kind, lang, format, post_type }) => {
			const params = { lang, format, ...(kind === 'posts' && post_type ? { post_type } : {}) };
			const res = await api.get(`io/export/${kind}`, { params, responseType: 'blob' });
			return { blob: res.data, headers: res.headers };
		},
	});
}

export function useImport() {
	return useMutation({
		mutationFn: async ({ kind, lang, format, body }) =>
			unwrap(await api.post(`io/import/${kind}`, { lang, format, body })),
	});
}

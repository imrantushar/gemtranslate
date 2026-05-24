import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

const countryQuery = (country) => (country ? { country } : {});

// React Query does deep equality on queryKey segments. `useParams()` yields
// the post id as a string while API responses give us a number, so we
// normalize to string in EVERY key (queries + invalidations). Otherwise
// invalidation silently misses and the UI only updates on hard reload.
const pid = (postId) => String(postId);

export function usePostFields(postId, lang, country = '') {
	return useQuery({
		queryKey: ['posts', pid(postId), 'fields', lang, country],
		queryFn: async () =>
			unwrap(await api.get(`posts/${postId}/fields/${lang}`, { params: countryQuery(country) })),
		enabled: !!postId && !!lang,
	});
}

export function useSavePostFields() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '', fields }) =>
			unwrap(
				await api.put(`posts/${postId}/fields/${lang}`, { fields }, { params: countryQuery(country) })
			),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

export function usePostVariants(postId, lang) {
	return useQuery({
		queryKey: ['posts', pid(postId), 'variants', lang],
		queryFn: async () => unwrap(await api.get(`posts/${postId}/variants/${lang}`)),
		enabled: !!postId && !!lang,
	});
}

export function useCreateVariant() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country_code }) =>
			unwrap(await api.post(`posts/${postId}/variants/${lang}`, { country_code })),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

export function usePromoteToLayout() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '' }) =>
			unwrap(
				await api.post(
					`posts/${postId}/translations/${lang}/promote-to-layout`,
					{},
					{ params: countryQuery(country) }
				)
			),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

export function useDemoteToStrings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '' }) =>
			unwrap(
				await api.post(
					`posts/${postId}/translations/${lang}/demote-to-strings`,
					{},
					{ params: countryQuery(country) }
				)
			),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

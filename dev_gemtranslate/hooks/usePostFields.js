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
				await api.put(
					`posts/${postId}/fields/${lang}`,
					{ fields },
					{ params: countryQuery(country) }
				)
			),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

export function useConfirmedSegments(postId, lang, country = '') {
	return useQuery({
		queryKey: ['posts', pid(postId), 'segments-confirmed', lang, country],
		queryFn: async () =>
			unwrap(
				await api.get(`posts/${postId}/segments/${lang}/confirmed`, {
					params: countryQuery(country),
				})
			),
		enabled: !!postId && !!lang,
	});
}

export function useSaveConfirmedSegments() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '', confirmed }) =>
			unwrap(
				await api.put(
					`posts/${postId}/segments/${lang}/confirmed`,
					{ confirmed },
					{ params: countryQuery(country) }
				)
			),
		// Optimistic — the toggle should feel instant; the server just persists.
		onMutate: async (vars) => {
			const key = ['posts', pid(vars.postId), 'segments-confirmed', vars.lang, vars.country || ''];
			await qc.cancelQueries({ queryKey: key });
			const prev = qc.getQueryData(key);
			qc.setQueryData(key, { confirmed: vars.confirmed });
			return { key, prev };
		},
		onError: (_e, _vars, ctx) => {
			if (ctx?.key) qc.setQueryData(ctx.key, ctx.prev);
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
		mutationFn: async ({ postId, lang, country = '', startFrom = 'translated' }) =>
			unwrap(
				await api.post(
					`posts/${postId}/translations/${lang}/promote-to-layout`,
					{ start_from: startFrom },
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

export function usePostUnits(postId, lang, country = '') {
	return useQuery({
		queryKey: ['posts', pid(postId), 'units', lang, country],
		queryFn: async () =>
			unwrap(await api.get(`posts/${postId}/units/${lang}`, { params: countryQuery(country) })),
		enabled: !!postId && !!lang,
	});
}

export function useSavePostUnits() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '', units }) =>
			unwrap(
				await api.put(
					`posts/${postId}/units/${lang}`,
					{ units },
					{ params: countryQuery(country) }
				)
			),
		onSuccess: (_d, vars) => {
			qc.invalidateQueries({ queryKey: ['posts', pid(vars.postId)] });
		},
	});
}

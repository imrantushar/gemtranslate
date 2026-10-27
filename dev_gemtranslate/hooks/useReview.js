import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';

export function useReviewQueue(page = 1, perPage = 20) {
	return useQuery({
		queryKey: ['review', 'queue', page, perPage],
		queryFn: async () =>
			unwrap(
				await api.get('posts/review-queue', {
					params: { page, per_page: perPage },
				})
			),
		keepPreviousData: true,
	});
}

/** Lightweight count for the sidebar badge; polls while items are pending. */
export function useReviewCount() {
	return useQuery({
		queryKey: ['review', 'count'],
		queryFn: async () => {
			const res = unwrap(await api.get('posts/review-queue', { params: { per_page: 1 } }));
			return res?.meta?.total ?? 0;
		},
		refetchInterval: 30000,
	});
}

const countryParam = (country) => (country ? { country } : {});

export function useApproveTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '' }) =>
			unwrap(
				await api.post(
					`posts/${postId}/translations/${lang}/approve`,
					{},
					{ params: countryParam(country) }
				)
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['review'] });
			qc.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

export function useRejectTranslation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ postId, lang, country = '' }) =>
			unwrap(
				await api.post(
					`posts/${postId}/translations/${lang}/reject`,
					{},
					{ params: countryParam(country) }
				)
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['review'] });
			qc.invalidateQueries({ queryKey: ['posts'] });
		},
	});
}

export function useBackfillAuto() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload = {}) => unwrap(await api.post('posts/backfill-auto', payload)),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['jobs'] });
			qc.invalidateQueries({ queryKey: ['review'] });
		},
	});
}

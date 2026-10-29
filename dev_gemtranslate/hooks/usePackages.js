import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';
import { gtransApi, useGetPackagesQuery } from '../lib/gtransApi';
import { store } from '../lib/store';

/** Refetch both the react-query string caches and the RTK Query package list. */
function invalidateStrings(qc) {
	store.dispatch(gtransApi.util.invalidateTags(['Packages']));
	return qc.invalidateQueries({ queryKey: ['strings'] });
}

/** Server-paginated plugins & themes: params = { page, per_page, search, type, slug }. */
export function usePackages(params = {}) {
	return useGetPackagesQuery(params);
}

export function useScanPackage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ slug }) => unwrap(await api.post(`strings/packages/${slug}/scan`)),
		onSuccess: () => invalidateStrings(qc),
	});
}

/** Stored audit findings for one package (null until it has been audited). */
export function usePackageAudit(slug, enabled = true) {
	return useQuery({
		queryKey: ['strings', 'audit', slug],
		enabled: !!slug && enabled,
		queryFn: async () => unwrap(await api.get(`strings/packages/${slug}/audit`)),
	});
}

/**
 * Run the audit to completion. The server works in time-boxed chunks, so keep
 * calling with the returned offset until it reports `done`.
 */
export function useAuditPackage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ slug, onProgress }) => {
			let offset = 0;
			for (;;) {
				const res = unwrap(await api.post(`strings/packages/${slug}/audit`, { offset }));
				if (onProgress) onProgress(res.next_offset, res.total_files);
				if (res.done) return res.audit;
				offset = res.next_offset;
			}
		},
		onSuccess: () => invalidateStrings(qc),
	});
}

/** Check (commit=false) or save (commit=true) a CSV returned by an AI model. */
export function useCsvImport() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ slug, lang, csv, overwrite = false, commit = false }) =>
			unwrap(await api.post(`strings/packages/${slug}/${lang}/csv-import`, { csv, overwrite, commit })),
		onSuccess: (data) => {
			if (data?.committed) invalidateStrings(qc);
		},
	});
}

/** The next batch of untranslated strings for a plugin/theme, plus the remaining total. */
export async function fetchUntranslated({ domain, lang, limit }) {
	const res = await api.get('strings', {
		params: { domain, lang, status: 'untranslated', page: 1, per_page: limit },
	});
	return { rows: unwrap(res) || [], total: getMeta(res).total || 0 };
}

export function useExportPackage() {
	return useMutation({
		mutationFn: async ({ slug, lang, exclude_status = '' }) =>
			unwrap(
				await api.post(`strings/packages/${slug}/${lang}/export`, {
					exclude_status,
				})
			),
	});
}

export function useBulkSaveStrings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ translations }) =>
			unwrap(await api.patch('strings/bulk', { translations })),
		onSuccess: () => invalidateStrings(qc),
	});
}

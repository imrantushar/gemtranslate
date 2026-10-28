import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

export function usePackages() {
	return useQuery({
		queryKey: ['strings', 'packages'],
		queryFn: async () => {
			const res = await api.get('strings/packages');
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
	});
}

export function useScanPackage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ slug }) => unwrap(await api.post(`strings/packages/${slug}/scan`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
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
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
	});
}

/** Check (commit=false) or save (commit=true) a CSV returned by an AI model. */
export function useCsvImport() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ slug, lang, csv, overwrite = false, commit = false }) =>
			unwrap(await api.post(`strings/packages/${slug}/${lang}/csv-import`, { csv, overwrite, commit })),
		onSuccess: (data) => {
			if (data?.committed) qc.invalidateQueries({ queryKey: ['strings'] });
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
		onSuccess: () => qc.invalidateQueries({ queryKey: ['strings'] }),
	});
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getMeta, unwrap } from '../lib/api';

/** Template parts, synced patterns and navigation menus, with progress per language. */
export function usePatternItems() {
	return useQuery({
		queryKey: ['patterns', 'items'],
		queryFn: async () => {
			const res = await api.get('layout/items');
			return { rows: unwrap(res) || [], meta: getMeta(res) };
		},
	});
}

export function usePatternUnits(id, lang, country = '') {
	return useQuery({
		queryKey: ['patterns', 'units', id, lang, country],
		queryFn: async () => unwrap(await api.get(`layout/units/${lang}`, { params: { id, country } })) || [],
		enabled: !!id && !!lang,
	});
}

/** Save a batch of { source, translation } for one language (and optional country). */
export function useSavePatternTranslations() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ lang, country = '', units }) =>
			unwrap(await api.put(`layout/translations/${lang}`, { country, units })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
	});
}

/** Country → alternate template part rules for one template part (`template_part:theme//slug`). */
export function usePatternVariants(part) {
	return useQuery({
		queryKey: ['patterns', 'variants', part],
		queryFn: async () => {
			const res = await api.get('layout/variants', { params: { part } });
			return { rules: unwrap(res) || [], choices: getMeta(res)?.choices || [] };
		},
		enabled: !!part && part.startsWith('template_part:'),
	});
}

/** Give a language (and optional country) its own copy of a template part. */
export function useCreateCustomPart() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ part, lang, country = '', start = 'copy' }) =>
			unwrap(await api.post('layout/custom', { part, lang, country, start })),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['patterns'] });
		},
	});
}

/** Go back to the shared layout; the copy stays in the Site Editor. */
export function useRemoveCustomPart() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ part, lang, country = '' }) =>
			unwrap(await api.delete('layout/custom', { data: { part, lang, country } })),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['patterns'] });
		},
	});
}

export function useSavePatternVariants() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ part, rules }) => unwrap(await api.put('layout/variants', { part, rules })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns', 'variants'] }),
	});
}

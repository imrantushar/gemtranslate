import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';
import { hasFeature } from './useFeatures';

export function useAIProviders() {
	return useQuery({
		queryKey: ['ai', 'providers'],
		queryFn: async () => unwrap(await api.get('ai/providers')),
	});
}

export function useSaveAIProviders() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.put('ai/providers', payload)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'providers'] }),
	});
}

export function useTestAIProvider() {
	return useMutation({
		mutationFn: async ({ name, ...rest }) =>
			unwrap(await api.post(`ai/providers/${name}/test`, rest)),
	});
}

export function useTranslateWithAI() {
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.post('ai/translate', payload)),
	});
}

export function useSuggestFromMemory() {
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.post('ai/memory/suggest', payload)),
	});
}

export function useMemoryStats() {
	return useQuery({
		queryKey: ['ai', 'memory'],
		queryFn: async () => unwrap(await api.get('ai/memory/stats')),
		// Translation Memory is Pro — don't hit the 402-gated endpoint in free.
		enabled: hasFeature('translation_memory'),
	});
}

export function useGlossary() {
	return useQuery({
		queryKey: ['ai', 'glossary'],
		queryFn: async () => unwrap(await api.get('ai/glossary')) || [],
		enabled: hasFeature('glossary'),
	});
}

export function useAddGlossaryTerm() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (payload) => unwrap(await api.post('ai/glossary', payload)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'glossary'] }),
	});
}

export function useDeleteGlossaryTerm() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id) => unwrap(await api.delete(`ai/glossary/${id}`)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'glossary'] }),
	});
}

// src/hooks/useDatasets.ts
// TanStack Query hook replacing all direct fetch/axios calls for dataset operations.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { datasetsApi } from "../api/datasets.api";
import type { CleanResult, UploadResult } from "../types/dataset";

// ── Query key factory (keeps keys consistent and refactorable) ─────────────
export const datasetKeys = {
  all: ["datasets"] as const,
  detail: (id: number) => ["datasets", id] as const,
  summary: (id: number, lang: string) => ["datasets", id, "summary", lang] as const,
  history: (sessionId: string) => ["chat", "history", sessionId] as const,
};

// ── Upload mutation ─────────────────────────────────────────────────────────
export function useUploadDataset() {
  const qc = useQueryClient();

  return useMutation<UploadResult, Error, File>({
    mutationFn: (file) => datasetsApi.upload(file),
    onSuccess: (data) => {
      // Cache the result immediately under its dataset id key
      qc.setQueryData(datasetKeys.detail(data.datasetId), data);
      // Invalidate the list so any dataset list view refreshes
      qc.invalidateQueries({ queryKey: datasetKeys.all });
    },
  });
}

// ── Clean mutation (optimistic update) ─────────────────────────────────────
export function useCleanDataset(datasetId: number) {
  const qc = useQueryClient();

  return useMutation<CleanResult, Error, void, { previous: UploadResult | undefined }>({
    mutationFn: () => datasetsApi.clean(datasetId),
    // Optimistic: immediately mark nullCounts as empty in cache
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: datasetKeys.detail(datasetId) });
      const previous = qc.getQueryData<UploadResult>(datasetKeys.detail(datasetId));
      qc.setQueryData(datasetKeys.detail(datasetId), (old: UploadResult | undefined) =>
        old ? { ...old, nullCounts: {}, duplicates: 0 } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on failure
      if (context?.previous) {
        qc.setQueryData(datasetKeys.detail(datasetId), context.previous);
      }
    },
    onSettled: () => {
      // Always refetch to get the real server state
      qc.invalidateQueries({ queryKey: datasetKeys.detail(datasetId) });
    },
  });
}

// ── AI Summary query ────────────────────────────────────────────────────────
export function useDatasetSummary(datasetId: number, language: string) {
  return useQuery({
    queryKey: datasetKeys.summary(datasetId, language),
    queryFn: () => datasetsApi.summary(datasetId, language),
    // Only fetch when a valid dataset is loaded
    enabled: datasetId > 0,
    staleTime: 5 * 60_000, // summaries stay fresh for 5 minutes
  });
}

// ── Chat history query ──────────────────────────────────────────────────────
export function useChatHistory(sessionId: string) {
  return useQuery({
    queryKey: datasetKeys.history(sessionId),
    queryFn: () => datasetsApi.history(sessionId),
    enabled: sessionId.length > 0,
  });
}

// ── Chat send mutation ──────────────────────────────────────────────────────
export function useSendChat(datasetId: number, sessionId: string, language: string) {
  const qc = useQueryClient();

  return useMutation<{ answer: string }, Error, string>({
    mutationFn: (question) =>
      datasetsApi.chat(datasetId, question, language, sessionId),
    onSuccess: () => {
      // Refetch history to include the new assistant message
      qc.invalidateQueries({ queryKey: datasetKeys.history(sessionId) });
    },
  });
}

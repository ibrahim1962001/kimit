// src/api/datasets.api.ts
import { apiClient } from "./client";
import type { UploadResult, CleanResult } from "../types/dataset";

export const datasetsApi = {
  /** Upload a file; returns full analysis payload */
  upload: async (file: File): Promise<UploadResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<UploadResult>("/api/upload", form);
    return data;
  },

  /** Safe upload just to store in MinIO without Pandas processing */
  storeFileOnly: async (file: File): Promise<{ saved_to_storage: boolean; minio_path: string }> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post("/api/files/upload", form);
    return data;
  },

  /** Clean a dataset by its DB id */
  clean: async (datasetId: number): Promise<CleanResult> => {
    const { data } = await apiClient.post<CleanResult>("/api/clean", { datasetId });
    return data;
  },

  /** Get AI executive summary */
  summary: async (datasetId: number, language: string): Promise<{ summary: string; suggestions: string[] }> => {
    const { data } = await apiClient.post("/api/ai/summary", { datasetId, language });
    return data;
  },

  /** Send a chat message */
  chat: async (
    datasetId: number,
    question: string,
    language: string,
    sessionId: string
  ): Promise<{ answer: string }> => {
    const { data } = await apiClient.post("/api/ai/chat", {
      datasetId, question, language, sessionId,
    });
    return data;
  },

  /** Get chat history for a session */
  history: async (sessionId: string): Promise<Array<{ role: string; content: string }>> => {
    const { data } = await apiClient.get(`/api/ai/history/${sessionId}`);
    return data;
  },

  /** Export dataset */
  export: async (datasetId: number, format: "csv" | "json", filename: string): Promise<Blob> => {
    const { data } = await apiClient.post(
      "/api/export",
      { datasetId, format, filename },
      { responseType: "blob" }
    );
    return data;
  },
  /** Import data from Google Sheets URL */
  importSheets: async (url: string): Promise<UploadResult> => {
    const { data } = await apiClient.post<UploadResult>("/api/datasets/import-sheets", { url });
    return data;
  },
  /** Download raw file from storage */
  downloadRaw: async (datasetId: number, filename: string): Promise<void> => {
    const { data } = await apiClient.get(`/api/datasets/${datasetId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

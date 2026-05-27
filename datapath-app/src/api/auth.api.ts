import { apiClient } from "./client";

export interface SyncUserResponse {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  plan: string;
  credit_balance: number;
  credit_status: string;
  created_at: string;
}

export const authApi = {
  /** Syncs the Firebase authenticated user with the PostgreSQL backend */
  sync: async (): Promise<SyncUserResponse> => {
    const { data } = await apiClient.post<SyncUserResponse>("/api/auth/sync");
    return data;
  },
};

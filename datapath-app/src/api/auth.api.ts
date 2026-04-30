import { apiClient } from "./client";

export const authApi = {
  /** Syncs the Firebase authenticated user with the PostgreSQL backend */
  sync: async (): Promise<void> => {
    await apiClient.post("/api/auth/sync");
  },
};

// src/api/client.ts
// Axios instance that injects the Firebase ID token on every request.
import axios from "axios";
import { getAuth } from "firebase/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({ baseURL: BASE_URL });

// Request interceptor — attach Bearer token automatically
apiClient.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — surface error detail from FastAPI
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail: string =
      err.response?.data?.detail ?? err.message ?? "Unknown error";
    return Promise.reject(new Error(detail));
  }
);

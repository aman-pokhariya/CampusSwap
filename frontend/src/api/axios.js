import axios from "axios";
import { toast } from "sonner";

// "/api" on the frontend's own origin: Vite proxies it to Express in development (vite.config.js),
// and Vercel will do the same in production (Chunk 7).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 20000,
});

// Every API helper returns the JSON body directly.
export const unwrap = (request) => request.then((res) => res.data);

// If the session dies while someone is using the app (expired, password changed elsewhere,
// account suspended), log them out of the UI at once. main.jsx passes in the Redux bits,
// which keeps this file free of store imports (no circular imports).
export const setupInterceptors = ({ isLoggedIn, onSessionLost }) => {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const banned = error.response?.data?.code === "ACCOUNT_BANNED";

      if (isLoggedIn() && (status === 401 || banned)) {
        onSessionLost();
        toast.error(error.response.data?.message || "Please log in again.");
      }

      return Promise.reject(error);
    },
  );
};

export default api;

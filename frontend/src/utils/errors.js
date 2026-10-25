// The API always answers errors as { success: false, message, errors?, code?, ... }.

export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const response = error?.response;

  if (response) {
    if (response.data?.message) return response.data.message;
    // The Vite proxy answers 5xx with no JSON body when Express isn't running.
    if (response.status >= 500) return "Can't reach the server. Is the backend running?";
    return fallback;
  }

  if (error?.code === "ECONNABORTED") return "The server took too long to respond. Try again.";
  if (error?.request) return "Can't reach the server. Check your connection.";
  return fallback;
};

// Field-level messages, e.g. { email: "Already registered" }
export const getFieldErrors = (error) => error?.response?.data?.errors ?? {};

// The whole error body, for checking `code`, `retryAfter`, etc.
export const getErrorData = (error) => error?.response?.data ?? {};

import { createApi } from "@reduxjs/toolkit/query/react";
import api from "./axios";
import { getErrorMessage } from "../utils/errors";

// RTK Query fetches through our axios instance, so cookies and the session-expiry
// interceptor work exactly like the rest of the app. Extra axios options (e.g. a longer
// `timeout` for photo uploads) are passed straight through.
const axiosBaseQuery = async ({ url, method = "GET", data, params, ...config }) => {
  try {
    const response = await api.request({ url, method, data, params, ...config });
    return { data: response.data };
  } catch (error) {
    return {
      error: {
        status: error.response?.status ?? "FETCH_ERROR",
        data: error.response?.data,
        message: getErrorMessage(error),
      },
    };
  }
};

// One API slice for the whole app. Feature files add their endpoints with injectEndpoints().
// Cached data is shared: opening a listing and coming back to the feed shows it instantly.
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery,
  tagTypes: [
    "Feed",
    "Listing",
    "MyListings",
    "Saved",
    "Profile",
    "Conversations",
    "Messages",
    "Notifications",
    "Deals",
    "Reviews",
    "Blocks",
    "Admin",
  ],
  keepUnusedDataFor: 120,
  endpoints: () => ({}),
});

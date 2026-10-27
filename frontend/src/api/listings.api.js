import { baseApi } from "./baseApi";
import api, { unwrap } from "./axios";

// Runs `recipe` on every cached copy of a listing (feed pages, detail page, saved, profiles),
// so a change shows everywhere at once. Returns patches that can be undone.
const patchListingEverywhere = (dispatch, state, id, recipe) => {
  const { selectCachedArgsForQuery, updateQueryData } = listingsApi.util;
  const patchList = (list = []) => list.forEach((listing) => listing._id === id && recipe(listing));
  const patches = [];
  const patch = (endpoint, update) => {
    for (const arg of selectCachedArgsForQuery(state, endpoint)) {
      patches.push(dispatch(updateQueryData(endpoint, arg, (draft) => update(draft, arg))));
    }
  };

  patch("getFeed", (draft) => draft.pages.forEach((page) => patchList(page.listings)));
  patch("getListing", (draft, arg) => {
    if (arg === id) recipe(draft.listing);
    patchList(draft.similar);
  });
  patch("getSavedListings", (draft) => patchList(draft.listings));
  patch("getProfile", (draft) => patchList(draft.listings));

  return patches;
};

export const listingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Infinite query: RTK Query keeps every loaded page; fetchNextPage() asks for page n+1.
    getFeed: build.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages, lastPageParam) => (lastPage.hasMore ? lastPageParam + 1 : undefined),
      },
      query: ({ queryArg, pageParam }) => ({ url: "/listings", params: { ...queryArg, page: pageParam } }),
      providesTags: ["Feed"],
    }),

    getListing: build.query({
      query: (id) => ({ url: `/listings/${id}` }),
      providesTags: (result, error, id) => [{ type: "Listing", id }],
    }),

    getMyListings: build.query({
      query: () => ({ url: "/listings/mine" }),
      providesTags: ["MyListings"],
    }),

    getSavedListings: build.query({
      query: () => ({ url: "/listings/saved" }),
      providesTags: ["Saved"],
    }),

    getProfile: build.query({
      query: (id) => ({ url: `/users/${id}` }),
      providesTags: (result, error, id) => [{ type: "Profile", id }],
    }),

    // Optimistic update: the heart fills instantly, and is rolled back if the request fails.
    setSaved: build.mutation({
      query: ({ id, saved }) => ({ url: `/listings/${id}/save`, method: saved ? "PUT" : "DELETE" }),
      async onQueryStarted({ id, saved }, { dispatch, getState, queryFulfilled }) {
        const patches = patchListingEverywhere(dispatch, getState(), id, (listing) => {
          if (listing.isSaved === saved) return;
          listing.isSaved = saved;
          if (typeof listing.saves === "number") listing.saves = Math.max(0, listing.saves + (saved ? 1 : -1));
        });
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags(["Saved"]));
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
    }),

    // Both also change the chats about the listing (its status chip, cancelled offers, a closed chat).
    updateListingStatus: build.mutation({
      query: ({ id, status }) => ({ url: `/listings/${id}/status`, method: "PATCH", data: { status } }),
      invalidatesTags: (result, error, { id }) => [{ type: "Listing", id }, "Feed", "MyListings", "Saved", "Profile", "Conversations", "Messages"],
    }),

    deleteListing: build.mutation({
      query: (id) => ({ url: `/listings/${id}`, method: "DELETE" }),
      // Includes the listing itself, so going "back" to it shows "not found" instead of stale data.
      invalidatesTags: (result, error, id) => [{ type: "Listing", id }, "Feed", "MyListings", "Saved", "Profile", "Conversations", "Messages"],
    }),
  }),
});

export const {
  useGetFeedInfiniteQuery,
  useGetListingQuery,
  useGetMyListingsQuery,
  useGetSavedListingsQuery,
  useGetProfileQuery,
  useSetSavedMutation,
  useUpdateListingStatusMutation,
  useDeleteListingMutation,
} = listingsApi;

// Creating/editing go through axios directly so we can show upload progress.
const withProgress = (onProgress) => ({
  timeout: 120000,
  onUploadProgress: (event) => {
    if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
  },
});

export const listingUploads = {
  create: (formData, onProgress) => unwrap(api.post("/listings", formData, withProgress(onProgress))),
  update: (id, formData, onProgress) => unwrap(api.patch(`/listings/${id}`, formData, withProgress(onProgress))),
};

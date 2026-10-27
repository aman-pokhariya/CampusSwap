import { baseApi } from "./baseApi";

// What a moderation decision can change: every admin list and count, plus what students see (listings
// coming back or disappearing, profiles' trust scores, deals that were cancelled).
const DECISION_TAGS = ["Admin", "Feed", "Listing", "MyListings", "Saved", "Profile", "Deals"];

// A decision that was refused because this tab's copy is out of date (another admin got there first,
// the listing was deleted) reloads the admin lists, so the screen shows what changed.
const decisionTags = (result, error) => {
  if (!error) return DECISION_TAGS;
  return [404, 409].includes(error.status) ? ["Admin"] : [];
};

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => {
    // Newest first. Each page starts before the oldest item already loaded (`key` is the list's name in
    // the answer). `queryArg` holds the filters: { campus, status } and so on.
    const adminList = (url, key) =>
      build.infiniteQuery({
        infiniteQueryOptions: {
          initialPageParam: null,
          getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage[key].length > 0 ? lastPage[key].at(-1).createdAt : undefined),
        },
        query: ({ queryArg, pageParam }) => ({ url, params: { ...queryArg, before: pageParam ?? undefined, limit: 20 } }),
        providesTags: [{ type: "Admin", id: key }],
      });

    return {
      // KPI counts. `campus`: a campus id, "all" (global admins) or undefined for the admin's own campus.
      getAdminOverview: build.query({
        query: (campus) => ({ url: "/admin/overview", params: { campus } }),
        providesTags: [{ type: "Admin", id: "overview" }],
      }),

      // { campus, status: "open" | "resolved" | "dismissed" }
      getAdminReports: adminList("/admin/reports", "reports"),
      // { campus, moderation: "flagged" | "removed" }
      getAdminListings: adminList("/admin/listings", "listings"),
      // { campus, q, banned: "true" | "false" }
      getAdminUsers: adminList("/admin/users", "users"),

      // Every campus, for a global admin's campus picker. They rarely change.
      getCampuses: build.query({
        query: () => ({ url: "/campuses" }),
        keepUnusedDataFor: 3600,
      }),

      // { id, action: "dismiss" | "remove_listing" | "restore_listing" | "warn_user" | "ban_user", note? }.
      // Answers { message, report, closed } (closed: how many reports the decision settled).
      resolveReport: build.mutation({
        query: ({ id, action, note }) => ({ url: `/admin/reports/${id}`, method: "PATCH", data: { action, note } }),
        invalidatesTags: decisionTags,
      }),

      // { id, action: "approve" | "remove" }
      moderateListing: build.mutation({
        query: ({ id, action }) => ({ url: `/admin/listings/${id}`, method: "PATCH", data: { action } }),
        invalidatesTags: decisionTags,
      }),

      // { id, banned }: suspend an account (and wind down everything it had going) or lift the suspension.
      setUserBanned: build.mutation({
        query: ({ id, banned }) => ({ url: `/admin/users/${id}`, method: "PATCH", data: { banned } }),
        invalidatesTags: decisionTags,
      }),
    };
  },
});

export const {
  useGetAdminOverviewQuery,
  useGetAdminReportsInfiniteQuery,
  useGetAdminListingsInfiniteQuery,
  useGetAdminUsersInfiniteQuery,
  useGetCampusesQuery,
  useResolveReportMutation,
  useModerateListingMutation,
  useSetUserBannedMutation,
} = adminApi;

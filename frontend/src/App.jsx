import { lazy, Suspense, useEffect, useRef } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster } from "sonner";
import { hydrateCurrentUser } from "./redux/authSlice";

import ProtectedRoute from "./components/routing/ProtectedRoute";
import AdminRoute from "./components/routing/AdminRoute";
import PublicOnlyRoute from "./components/routing/PublicOnlyRoute";
import ScrollRestoration from "./components/routing/ScrollRestoration";
import PublicLayout from "./components/layout/PublicLayout";
import AuthLayout from "./components/layout/AuthLayout";
import AppLayout from "./components/layout/AppLayout";
import PageLoader from "./components/ui/PageLoader";

// Pages load on demand, so visitors only download the code for screens they open.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Home = lazy(() => import("./pages/Home"));
const ListingDetail = lazy(() => import("./pages/listings/ListingDetail"));
const CreateListing = lazy(() => import("./pages/listings/CreateListing"));
const EditListing = lazy(() => import("./pages/listings/EditListing"));
const MyListings = lazy(() => import("./pages/listings/MyListings"));
const SavedListings = lazy(() => import("./pages/listings/SavedListings"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Inbox = lazy(() => import("./pages/chat/Inbox"));
const InboxEmpty = lazy(() => import("./pages/chat/InboxEmpty"));
const ChatView = lazy(() => import("./pages/chat/ChatView"));
const Deals = lazy(() => import("./pages/deals/Deals"));
const DealDetail = lazy(() => import("./pages/deals/DealDetail"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme.mode);
  const hydrated = useRef(false);

  // Ask the server who is logged in, once (StrictMode runs effects twice in development).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    dispatch(hydrateCurrentUser());
  }, [dispatch]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Storage can be blocked (private mode); the theme just won't be remembered.
    }
  }, [theme]);

  return (
    <>
      <ScrollRestoration />
      <Routes>
        <Route
          element={
            <PublicOnlyRoute>
              <PublicLayout />
            </PublicOnlyRoute>
          }
        >
          <Route index element={<Landing />} />
        </Route>

        <Route
          element={
            <PublicOnlyRoute>
              <AuthLayout />
            </PublicOnlyRoute>
          }
        >
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="home" element={<Home />} />
          <Route path="sell" element={<CreateListing />} />
          <Route path="listings/:id" element={<ListingDetail />} />
          <Route path="listings/:id/edit" element={<EditListing />} />
          <Route path="my-listings" element={<MyListings />} />
          <Route path="saved" element={<SavedListings />} />
          <Route path="u/:id" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="inbox" element={<Inbox />}>
            <Route index element={<InboxEmpty />} />
            <Route path=":conversationId" element={<ChatView />} />
          </Route>
          <Route path="deals" element={<Deals />} />
          <Route path="deals/:id" element={<DealDetail />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
        </Route>

        <Route
          path="*"
          element={
            <Suspense fallback={<PageLoader />}>
              <NotFound />
            </Suspense>
          }
        />
      </Routes>
      {/* At the bottom (right corner on wide screens), 6rem up: clear of the phone tab bar with its raised
          Sell button and of a chat's composer, and never over the navbar or a chat's header. */}
      <Toaster
        theme={theme}
        position="bottom-right"
        offset={{ bottom: "calc(6rem + env(safe-area-inset-bottom))", right: "1.5rem" }}
        mobileOffset={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        richColors
        closeButton
      />
    </>
  );
}

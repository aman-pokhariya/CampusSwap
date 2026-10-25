import { useEffect, useRef } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster } from "sonner";
import { hydrateCurrentUser } from "./redux/authSlice";

import ProtectedRoute from "./components/routing/ProtectedRoute";
import PublicOnlyRoute from "./components/routing/PublicOnlyRoute";
import ScrollToTop from "./components/routing/ScrollToTop";
import PublicLayout from "./components/layout/PublicLayout";
import AuthLayout from "./components/layout/AuthLayout";
import AppLayout from "./components/layout/AppLayout";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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
      <ScrollToTop />
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
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster theme={theme} position="top-center" richColors closeButton />
    </>
  );
}

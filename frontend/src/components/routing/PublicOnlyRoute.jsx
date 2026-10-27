import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import SplashScreen from "../ui/SplashScreen";

// Landing and auth pages. As soon as a user exists (after login, verify or reset) this
// redirects to where they were heading, or /home, so those pages never navigate themselves.
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) return <SplashScreen />;
  // Passing the whole saved location keeps its ?query too (e.g. feed filters).
  if (user) return <Navigate to={location.state?.from ?? "/home"} replace />;

  return children;
}

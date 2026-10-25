import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import SplashScreen from "../ui/SplashScreen";

// Logged-in users only. Others go to /login, which sends them back here afterwards.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

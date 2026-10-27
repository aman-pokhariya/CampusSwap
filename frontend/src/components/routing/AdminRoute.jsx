import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

// Admins only (inside ProtectedRoute, so someone is logged in). Everyone else goes back to the feed;
// the server refuses them anyway.
export default function AdminRoute({ children }) {
  const user = useSelector((state) => state.auth.user);

  if (user?.role !== "admin") return <Navigate to="/home" replace />;

  return children;
}

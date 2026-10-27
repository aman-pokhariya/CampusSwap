import { useNavigate } from "react-router-dom";

// const goBack = useGoBack("/home")
// An in-page "Back": the previous page when this tab came from inside the app, else `fallback` (a
// shared link opened in a new tab). React Router numbers this tab's history entries in
// history.state.idx, and the login redirects only replace entries, so a shared link that went through
// the login page still counts as the tab's first page.
export function useGoBack(fallback) {
  const navigate = useNavigate();
  return () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback));
}

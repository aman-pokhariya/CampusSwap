import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { store } from "./redux/store";
import { clearCurrentUser } from "./redux/authSlice";
import { resetChat } from "./redux/chatSlice";
import { setupInterceptors } from "./api/axios";
import { baseApi } from "./api/baseApi";
import { announceSession, onSessionAnnounced } from "./utils/sessionSync";

setupInterceptors({
  isLoggedIn: () => Boolean(store.getState().auth.user),
  onSessionLost: () => {
    store.dispatch(clearCurrentUser());
    // Forget cached listings, chats etc., so the next person to log in never sees this user's data.
    store.dispatch(baseApi.util.resetApiState());
    store.dispatch(resetChat());
    announceSession(null);
  },
});

// Another tab logged in or out. A tab still showing someone else starts over from the cookie, which
// also drops its cached data, chat state and live connection. Tabs already showing that person
// (or nobody, after a logout) keep what they have, such as a half-written listing.
onSessionAnnounced((userId) => {
  if (userId !== (store.getState().auth.user?._id ?? null)) window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);

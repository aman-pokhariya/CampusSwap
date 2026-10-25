import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { store } from "./redux/store";
import { clearCurrentUser } from "./redux/authSlice";
import { setupInterceptors } from "./api/axios";

setupInterceptors({
  isLoggedIn: () => Boolean(store.getState().auth.user),
  onSessionLost: () => store.dispatch(clearCurrentUser()),
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

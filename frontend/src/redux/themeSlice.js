import { createSlice } from "@reduxjs/toolkit";

// index.html already applied the saved theme before React started; start from that.
const initialMode = document.documentElement.classList.contains("dark") ? "dark" : "light";

const themeSlice = createSlice({
  name: "theme",
  initialState: { mode: initialMode },
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === "dark" ? "light" : "dark";
    },
  },
});

export const { toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "../api/auth.api";

// Runs once when the app loads: asks the server who the cookie belongs to.
export const hydrateCurrentUser = createAsyncThunk("auth/hydrate", async (_, { rejectWithValue }) => {
  try {
    const { user } = await authApi.me();
    return user;
  } catch {
    return rejectWithValue(null);
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, loading: true },
  reducers: {
    setCurrentUser: (state, action) => {
      state.user = action.payload;
      state.loading = false;
    },
    clearCurrentUser: (state) => {
      state.user = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(hydrateCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(hydrateCurrentUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
      });
  },
});

export const { setCurrentUser, clearCurrentUser } = authSlice.actions;
export default authSlice.reducer;

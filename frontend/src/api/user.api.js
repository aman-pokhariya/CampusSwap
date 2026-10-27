import api, { unwrap } from "./axios";

export const userApi = {
  updateProfile: (body) => unwrap(api.patch("/users/me", body)),
  changePassword: (body) => unwrap(api.patch("/users/me/password", body)),
  updateAvatar: (formData) => unwrap(api.patch("/users/me/avatar", formData, { timeout: 60000 })),
  removeAvatar: () => unwrap(api.delete("/users/me/avatar")),
};

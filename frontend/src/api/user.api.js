import api, { unwrap } from "./axios";

export const userApi = {
  updateProfile: (body) => unwrap(api.patch("/users/me", body)),
  changePassword: (body) => unwrap(api.patch("/users/me/password", body)),
};

import api, { unwrap } from "./axios";

export const campusApi = {
  list: () => unwrap(api.get("/campuses")),
};

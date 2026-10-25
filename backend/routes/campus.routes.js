import express from "express";
import { listCampuses, getCampus } from "../controllers/campus.controllers.js";

const campusRoutes = express.Router();

campusRoutes.get("/", listCampuses);
campusRoutes.get("/:slug", getCampus);

export default campusRoutes;

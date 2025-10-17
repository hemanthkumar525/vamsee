import express from "express";
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js";
import { protectRoute } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protectRoute, createProject);
router.get("/", protectRoute, getProjects);
router.get("/:id", protectRoute, getProjectById);
router.put("/:id", protectRoute, updateProject);
router.delete("/:id", protectRoute, deleteProject);

export default router;

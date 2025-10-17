import asyncHandler from "express-async-handler";
import Project from "../models/projectModel.js";

// Create a new project
export const createProject = asyncHandler(async (req, res) => {
  const { name, description, team } = req.body;
  const createdBy = req.user.userId;
  if (!name) {
    res.status(400);
    throw new Error("Project name is required");
  }
  const project = await Project.create({ name, description, team, createdBy });
  res.status(201).json(project);
});

// Get all projects (optionally filter by user/team)
export const getProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find().populate("team", "name email").populate("createdBy", "name email");
  res.json(projects);
});

// Get single project by ID
export const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate("team", "name email").populate("createdBy", "name email");
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  res.json(project);
});

// Update a project
export const updateProject = asyncHandler(async (req, res) => {
  const { name, description, team } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  if (name) project.name = name;
  if (description) project.description = description;
  if (team) project.team = team;
  await project.save();
  res.json(project);
});

// Delete a project
export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  await project.deleteOne();
  res.json({ message: "Project deleted" });
});

import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Notice from "../models/notis.js";
import Task from "../models/taskModel.js";
import User from "../models/userModel.js";
 
const createTask = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.user;
    const { title, team, stage, date, priority, assets, links, description, assignedTo, project, startDate, endDate, tags, isGoal } = req.body;
 
    // Ensure the creator is always in the team
    let updatedTeam = team || [];
    if (!updatedTeam.includes(userId)) {
      updatedTeam.push(userId);
    }
 
    //alert users of the task
    let text = "New task has been assigned to you";
    if (updatedTeam?.length > 1) {
      text = text + ` and ${updatedTeam?.length - 1} others.`;
    }
 
    text =
      text +
      ` The task priority is set a ${priority} priority, so check and act accordingly. The task date is ${new Date(
        date
      ).toDateString()}. Thank you!!!`;
 
    const activity = {
      type: "assigned",
      activity: text,
      by: userId,
    };
 
    let newLinks = [];
    if (links) {
      newLinks = links.split(",");
    }
 
    const task = await Task.create({
      title,
      team: updatedTeam,
      stage: stage?.toLowerCase(),
      date,
      priority: priority?.toLowerCase(),
      activities: [activity],
      assets,
      links: newLinks || [],
      description,
      assignedTo: assignedTo || (updatedTeam && updatedTeam.length === 1 ? updatedTeam[0] : null),
      assignedBy: userId,
      project: project || null,
      startDate: startDate || null,
      endDate: endDate || null,
      tags: Array.isArray(tags) ? tags : [],
      isGoal: !!isGoal,
    });
 
    await Notice.create({
      team: updatedTeam,
      text,
      task: task._id,
    });
 
    const users = await User.find({
      _id: updatedTeam,
    });
 
    if (users) {
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        await User.findByIdAndUpdate(user._id, { $push: { tasks: task._id } });
      }
    }
 
    res
      .status(200)
      .json({ status: true, task, message: "Task created successfully." });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
});
 
const duplicateTask = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
 
    const task = await Task.findById(id);
 
    //alert users of the task
    let text = "New task has been assigned to you";
    if (task.team?.length > 1) {
      text = text + ` and ${task.team?.length - 1} others.`;
    }
 
    text =
      text +
      ` The task priority is set a ${
        task.priority
      } priority, so check and act accordingly. The task date is ${new Date(
        task.date
      ).toDateString()}. Thank you!!!`;
 
    const activity = {
      type: "assigned",
      activity: text,
      by: userId,
    };
 
    const newTask = await Task.create({
      ...task,
      title: "Duplicate - " + task.title,
    });
 
    newTask.team = task.team;
    newTask.subTasks = task.subTasks;
    newTask.assets = task.assets;
    newTask.links = task.links;
    newTask.priority = task.priority;
    newTask.stage = task.stage;
    newTask.activities = activity;
    newTask.description = task.description;
 
    await newTask.save();
 
    await Notice.create({
      team: newTask.team,
      text,
      task: newTask._id,
    });
 
    res
      .status(200)
      .json({ status: true, message: "Task duplicated successfully." });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
});
 
const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, date, team, stage, priority, assets, links, description, project, startDate, endDate, tags } = req.body;
 
  try {
    const task = await Task.findById(id);
 
    let newLinks = [];
 
    if (links) {
      newLinks = links.split(",");
    }
 
    task.title = title;
    task.date = date;
    task.priority = priority.toLowerCase();
    task.assets = assets;
    task.stage = stage.toLowerCase();
    task.team = team;
    task.links = newLinks;
    task.description = description;
    task.project = project || null;
    task.startDate = startDate || null;
    task.endDate = endDate || null;
    task.tags = Array.isArray(tags) ? tags : [];
 
    await task.save();
 
    res
      .status(200)
      .json({ status: true, message: "Task updated successfully." });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const updateTaskStage = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
 
    const task = await Task.findById(id);
 
    task.stage = stage.toLowerCase();
 
    await task.save();
 
    res
      .status(200)
      .json({ status: true, message: "Task stage changed successfully." });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
// Start task timer
const startTaskTimer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
 
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ status: false, message: "Task not found" });
  if (task.runningTimer?.startedAt) {
    return res.status(400).json({ status: false, message: "Timer already running" });
  }
 
  // Resolve names for clearer activity log
  const [byUser, responsible] = await Promise.all([
    User.findById(userId).select("name email"),
    task.assignedTo ? User.findById(task.assignedTo).select("name email") : null,
  ]);
 
  const byName = byUser?.name || byUser?.email || "Someone";
  const respName = responsible?.name || responsible?.email || "Unassigned";
 
  task.runningTimer = { startedAt: new Date(), startedBy: userId };
  task.activities.push({
    type: "started",
    activity: `${byName} started the timer (responsible: ${respName}).`,
    by: userId,
  });
  await task.save();
 
  res.status(200).json({ status: true, message: "Timer started", task });
});
 
// Stop task timer
const stopTaskTimer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
 
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ status: false, message: "Task not found" });
  if (!task.runningTimer?.startedAt) {
    return res.status(400).json({ status: false, message: "No running timer" });
  }
 
  const startedAt = new Date(task.runningTimer.startedAt).getTime();
  const now = Date.now();
  const delta = Math.max(0, now - startedAt);
 
  // Resolve names for clearer activity log
  const [byUser, responsible] = await Promise.all([
    User.findById(userId).select("name email"),
    task.assignedTo ? User.findById(task.assignedTo).select("name email") : null,
  ]);
 
  const byName = byUser?.name || byUser?.email || "Someone";
  const respName = responsible?.name || responsible?.email || "Unassigned";
 
  task.totalTrackedMs = (task.totalTrackedMs || 0) + delta;
  task.runningTimer = undefined;
  task.activities.push({
    type: "in progress",
    activity: `${byName} stopped the timer (+${Math.round(delta/1000)}s) (responsible: ${respName}).`,
    by: userId,
  });
  await task.save();
 
  res.status(200).json({ status: true, message: "Timer stopped", task });
});
 
const updateSubTaskStage = asyncHandler(async (req, res) => {
  try {
    const { taskId, subTaskId } = req.params;
    const { status } = req.body;
 
    await Task.findOneAndUpdate(
      {
        _id: taskId,
        "subTasks._id": subTaskId,
      },
      {
        $set: {
          "subTasks.$.isCompleted": status,
        },
      }
    );
 
    res.status(200).json({
      status: true,
      message: status
        ? "Task has been marked completed"
        : "Task has been marked uncompleted",
    });
  } catch (error) {
 
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const createSubTask = asyncHandler(async (req, res) => {
  const { title, tag, date } = req.body;
  const { id } = req.params;
 
  try {
    const newSubTask = {
      title,
      date,
      tag,
      isCompleted: false,
    };
 
    const task = await Task.findById(id);
 
    task.subTasks.push(newSubTask);
 
    await task.save();
 
    res
      .status(200)
      .json({ status: true, message: "SubTask added successfully." });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const getTasks = asyncHandler(async (req, res) => {
  const { userId, isAdmin } = req.user;
  const { stage, isTrashed, search, member } = req.query;
 
  let query = { isTrashed: isTrashed ? true : false, isGoal: false };
 
  if (member) {
    if (mongoose.Types.ObjectId.isValid(member)) {
      query.team = { $all: [new mongoose.Types.ObjectId(member)] };
    } else {
      return res.status(400).json({ status: false, message: "Invalid member identifier" });
    }
  } else if (!isAdmin) {
    query.team = { $all: [userId] };
  }
  if (stage) {
    query.stage = stage;
  }
  if (req.query.project) {
    query.project = req.query.project;
  }
 
  if (search) {
    const searchQuery = {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { stage: { $regex: search, $options: "i" } },
        { priority: { $regex: search, $options: "i" } },
      ],
    };
    query = { ...query, ...searchQuery };
  }
 
  let queryResult = Task.find(query)
    .populate({
      path: "team",
      select: "name title email",
    })
    .populate({
      path: "project",
      select: "name _id",
    })
    .sort({ updatedAt: -1 });
 
  const tasks = await queryResult;
 
  res.status(200).json({
    status: true,
    tasks,
  });
});
 
const getTask = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
 
    const task = await Task.findById(id)
      .populate({
        path: "team",
        select: "name title role email",
      })
      .populate({
        path: "activities.by",
        select: "name",
      })
      .populate({
        path: "project",
        select: "name _id",
      })
      .sort({ _id: -1 });
 
    res.status(200).json({
      status: true,
      task,
    });
  } catch (error) {
 
    throw new Error("Failed to fetch task", error);
  }
});
 
const postTaskActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const { type, activity } = req.body;
 
  try {
    const task = await Task.findById(id);
 
    const data = {
      type,
      activity,
      by: userId,
    };
    task.activities.push(data);
 
    await task.save();
 
    res
      .status(200)
      .json({ status: true, message: "Activity posted successfully." });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const trashTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
 
  try {
    const task = await Task.findById(id);
 
    task.isTrashed = true;
 
    await task.save();
 
    res.status(200).json({
      status: true,
      message: `Task trashed successfully.`,
    });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const deleteRestoreTask = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType } = req.query;
 
    if (actionType === "delete") {
      await Task.findByIdAndDelete(id);
    } else if (actionType === "deleteAll") {
      await Task.deleteMany({ isTrashed: true });
    } else if (actionType === "restore") {
      const resp = await Task.findById(id);
 
      resp.isTrashed = false;
 
      resp.save();
    } else if (actionType === "restoreAll") {
      await Task.updateMany(
        { isTrashed: true },
        { $set: { isTrashed: false } }
      );
    }
 
    res.status(200).json({
      status: true,
      message: `Operation performed successfully.`,
    });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const dashboardStatistics = asyncHandler(async (req, res) => {
  try {
    const { userId, isAdmin } = req.user;
 
    // Fetch all tasks from the database
    const allTasks = isAdmin
      ? await Task.find({
          isTrashed: false,
        })
          .populate({
            path: "team",
            select: "name role title email",
          })
          .sort({ updatedAt: -1 })
      : await Task.find({
          isTrashed: false,
          team: { $all: [userId] },
        })
          .populate({
            path: "team",
            select: "name role title email",
          })
          .sort({ updatedAt: -1 });
 
    const users = await User.find({ isActive: true })
      .select("name title role isActive createdAt")
      .limit(10)
      .sort({ _id: -1 });
 
    // Group tasks by stage and calculate counts
    const groupedTasks = allTasks?.reduce((result, task) => {
      const stage = task.stage;
 
      if (!result[stage]) {
        result[stage] = 1;
      } else {
        result[stage] += 1;
      }
 
      return result;
    }, {});
 
    const graphData = Object.entries(
      allTasks?.reduce((result, task) => {
        const { priority } = task;
        result[priority] = (result[priority] || 0) + 1;
        return result;
      }, {})
    ).map(([name, total]) => ({ name, total }));
 
    // Calculate total tasks
    const totalTasks = allTasks.length;
    const last10Task = allTasks?.slice(0, 10);
 
    // Combine results into a summary object
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
 
    const upcoming = allTasks.filter((task) => task.stage !== "completed");
 
    // Build upcoming goals (weekly/monthly) with flags
    const formatGoal = (task) => {
      const rawDue = task.endDate || task.date || task.updatedAt || task.createdAt;
      const dueDate = rawDue ? new Date(rawDue) : null;
      const nowTs = Date.now();
      const dueTs = dueDate ? dueDate.getTime() : 0;
      const isExpired = !!dueDate && dueTs < nowTs && task.stage !== 'completed';
      const isNearDue = !!dueDate && dueTs >= nowTs && (dueTs - nowTs) <= 48 * 60 * 60 * 1000 && task.stage !== 'completed';
      return {
        _id: task._id,
        title: task.title,
        priority: task.priority,
        stage: task.stage,
        dueDate,
        isExpired,
        isNearDue,
        project: task.project,
        team: task.team,
      };
    };
 
    const parseDate = (value) => (value ? new Date(value) : null);
    const weeklyGoals = upcoming
      .map((task) => ({ task, dueDate: parseDate(task.endDate || task.date || task.updatedAt) }))
      .filter(({ dueDate }) => dueDate && dueDate >= now && dueDate <= endOfWeek)
      .map(({ task }) => formatGoal(task));
    const monthlyGoals = upcoming
      .map((task) => ({ task, dueDate: parseDate(task.endDate || task.date || task.updatedAt) }))
      .filter(({ dueDate }) => dueDate && dueDate > endOfWeek && dueDate <= endOfMonth)
      .map(({ task }) => formatGoal(task));
 
    const summary = {
      totalTasks,
      last10Task,
      users: isAdmin ? users : [],
      tasks: groupedTasks,
      graphData,
      weeklyGoals,
      monthlyGoals,
    };
 
    res
      .status(200)
      .json({ status: true, ...summary, message: "Successfully." });
  } catch (error) {
 
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
const getGoals = asyncHandler(async (req, res) => {
  try {
    const { userId, isAdmin } = req.user;
    const { member } = req.query;
 
    // Base query for goals
    const baseQuery = { isTrashed: false, isGoal: true };
 
    // Restrict non-admins to their own team
    if (!isAdmin) {
      baseQuery.team = { $all: [userId] };
    }
 
    // Optional member filter (only applied if provided and valid)
    if (member && mongoose.Types.ObjectId.isValid(member)) {
      const memberId = new mongoose.Types.ObjectId(member);
      if (!isAdmin) {
        // Non-admin: must include both self and selected member
        baseQuery.team = { $all: [userId, memberId] };
      } else {
        baseQuery.team = { $all: [memberId] };
      }
    }
 
    const allTasks = await Task.find(baseQuery)
      .populate({ path: "team", select: "name role title email" })
      .populate({ path: "project", select: "name" })
      .sort({ _id: -1 });
 
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
 
    const upcoming = allTasks.filter((task) => task.stage !== "completed");
 
    const formatGoal = (task) => {
      const rawDue = task.endDate || task.date || task.updatedAt || task.createdAt;
      const dueDate = rawDue ? new Date(rawDue) : null;
      const nowTs = Date.now();
      const dueTs = dueDate ? dueDate.getTime() : 0;
      const isExpired = !!dueDate && dueTs < nowTs && task.stage !== 'completed';
      const isNearDue = !!dueDate && dueTs >= nowTs && (dueTs - nowTs) <= 48 * 60 * 60 * 1000 && task.stage !== 'completed';
      return {
        _id: task._id,
        title: task.title,
        priority: task.priority,
        stage: task.stage,
        dueDate,
        isExpired,
        isNearDue,
        project: task.project,
        team: task.team,
      };
    };
 
    const parseDate = (value) => (value ? new Date(value) : null);
 
    const weeklyGoals = upcoming
      .map((task) => ({ task, dueDate: parseDate(task.endDate || task.date || task.updatedAt) }))
      .filter(({ dueDate }) => dueDate && dueDate >= now && dueDate <= endOfWeek)
      .map(({ task }) => formatGoal(task));
 
    const monthlyGoals = upcoming
      .map((task) => ({ task, dueDate: parseDate(task.endDate || task.date || task.updatedAt) }))
      .filter(({ dueDate }) => dueDate && dueDate > endOfWeek && dueDate <= endOfMonth)
      .map(({ task }) => formatGoal(task));
 
    const expiredGoals = upcoming
      .map((task) => ({ task, dueDate: parseDate(task.endDate || task.date || task.updatedAt) }))
      .filter(({ dueDate }) => dueDate && dueDate < now)
      .map(({ task }) => formatGoal(task));
 
    const laterGoals = upcoming
      .map((task) => ({ task, dueDate: parseDate(task.endDate || task.date || task.updatedAt) }))
      .filter(({ dueDate }) => !dueDate || dueDate > endOfMonth)
      .map(({ task }) => formatGoal(task));
 
    res.status(200).json({ status: true, weeklyGoals, monthlyGoals, expiredGoals, laterGoals });
  } catch (error) {
    return res.status(400).json({ status: false, message: error.message });
  }
});
 
export {
  createSubTask,
  createTask,
  dashboardStatistics,
  deleteRestoreTask,
  duplicateTask,
  getTask,
  getTasks,
  getGoals,
  postTaskActivity,
  trashTask,
  updateSubTaskStage,
  updateTask,
  updateTaskStage,
  startTaskTimer,
  stopTaskTimer,
};
 
 

const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const Team = require("../models/Team");

const getUserTeamIds = async (user) => {
    if (user.role === "ADMIN") {
        return null;
    }

    const teams = await Team.find({
        $or: [
            { owner: user.userId },
            { members: user.userId }
        ]
    }).select("_id");

    return teams.map((team) => team._id);
};

const getProjectAssignableUserIds = async (projectId) => {
    const project = await Project.findById(projectId).populate(
        "teams",
        "owner members"
    );

    if (!project) {
        return {};
    }

    const assignableUserIds = new Set([
        project.manager.toString(),
        ...project.members.map((member) => member.toString())
    ]);

    project.teams.forEach((team) => {
        assignableUserIds.add(team.owner.toString());
        team.members.forEach((member) => {
            assignableUserIds.add(member.toString());
        });
    });

    return {
        project,
        assignableUserIds
    };
};

const canWorkInProject = (user, project, assignableUserIds) =>
    user.role === "ADMIN" ||
    project.manager.toString() === user.userId ||
    assignableUserIds.has(user.userId);

const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            dueDate,
            project,
            assignedTo
        } = req.body;

        if (!title || !project) {
            return res.status(400).json({
                message: "Task title and project are required"
            });
        }

        const { project: projectExists, assignableUserIds } =
            await getProjectAssignableUserIds(project);

        if (!projectExists) {
            return res.status(400).json({
                message: "Selected project does not exist"
            });
        }

        if (
            !canWorkInProject(req.user, projectExists, assignableUserIds)
        ) {
            return res.status(403).json({
                message:
                    "You can only create tasks for projects you belong to"
            });
        }

        if (assignedTo) {
            const assignedUser = await User.findById(assignedTo);

            if (!assignedUser) {
                return res.status(400).json({
                    message: "Selected user does not exist"
                });
            }

            if (assignedUser.role === "ADMIN") {
                return res.status(400).json({
                    message:
                        "Tasks cannot be assigned to administrators"
                });
            }

            if (
                !assignableUserIds.has(assignedUser._id.toString())
            ) {
                return res.status(400).json({
                    message:
                        "Tasks can only be assigned to people on the selected project"
                });
            }
        }

        if (dueDate && new Date(dueDate) < new Date()) {
            return res.status(400).json({
                message: "Due date cannot be in the past"
            });
        }

        const task = await Task.create({
            title: title.trim(),
            description,
            status,
            priority,
            dueDate,
            project,
            assignedTo,
            createdBy: req.user.userId
        });

        const io = req.app.get("io");

        if (io) {
            io.emit("taskCreated", {
                taskId: task._id.toString()
            });
        }

        res.status(201).json({
            message: "Task created successfully",
            task
        });
    } catch (error) {
        console.error("Create task error:", error);

        res.status(500).json({
            message: "Failed to create task"
        });
    }
};

const getTasks = async (req, res) => {
    try {
        let tasks;

        if (req.user.role === "ADMIN") {
            tasks = await Task.find()
                .populate("project", "name status manager")
                .populate("assignedTo", "name email role")
                .populate("createdBy", "name email role")
                .sort({ createdAt: -1 });
        } else {
            const teamIds = await getUserTeamIds(req.user);
            const visibleProjects = await Project.find({
                $or: [
                    { manager: req.user.userId },
                    { members: req.user.userId },
                    { teams: { $in: teamIds } }
                ]
            }).select("_id");

            const projectIds = visibleProjects.map(
                (project) => project._id
            );

            tasks = await Task.find({
                $or: [
                    { project: { $in: projectIds } },
                    { assignedTo: req.user.userId },
                    { createdBy: req.user.userId }
                ]
            })
                .populate("project", "name status manager")
                .populate("assignedTo", "name email role")
                .populate("createdBy", "name email role")
                .sort({ createdAt: -1 });
        }

        res.status(200).json({
            tasks
        });
    } catch (error) {
        console.error("Get tasks error:", error);

        res.status(500).json({
            message: "Failed to retrieve tasks"
        });
    }
};

const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate("project", "name status manager")
            .populate("assignedTo", "name email role")
            .populate("createdBy", "name email role");

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        if (req.user.role === "ADMIN") {
            return res.status(200).json({
                task
            });
        }

        const taskProject = await Project.findById(task.project);

        if (
            taskProject &&
            taskProject.manager.toString() === req.user.userId
        ) {
            return res.status(200).json({
                task
            });
        }

        if (task.createdBy?._id.toString() === req.user.userId) {
            return res.status(200).json({
                task
            });
        }

        if (
            req.user.role === "TEAM_MEMBER" &&
            task.assignedTo &&
            task.assignedTo._id.toString() === req.user.userId
        ) {
            return res.status(200).json({
                task
            });
        }

        return res.status(403).json({
            message: "You are not authorized to view this task"
        });
    } catch (error) {
        console.error("Get task error:", error);

        res.status(500).json({
            message: "Failed to retrieve task"
        });
    }
};

const updateTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            dueDate,
            project,
            assignedTo
        } = req.body;

        const task = req.task;
        const currentProject = await Project.findById(task.project);
        const canFullyManageTask =
            req.user.role === "ADMIN" ||
            (currentProject &&
                currentProject.manager.toString() === req.user.userId) ||
            task.createdBy.toString() === req.user.userId;

        if (!canFullyManageTask) {
            const attemptedRestrictedChange =
                title !== undefined ||
                description !== undefined ||
                priority !== undefined ||
                dueDate !== undefined ||
                project !== undefined ||
                assignedTo !== undefined;

            if (attemptedRestrictedChange) {
                return res.status(403).json({
                    message:
                        "Team members can only update the status of assigned tasks"
                });
            }

            if (status === undefined) {
                return res.status(400).json({
                    message: "Task status is required"
                });
            }

            task.status = status;
            await task.save();

            const io = req.app.get("io");

            if (io) {
                io.emit("taskUpdated", {
                    taskId: task._id.toString()
                });
            }

            return res.status(200).json({
                message: "Task updated successfully",
                task
            });
        }

        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({
                    message: "Task title cannot be empty"
                });
            }

            task.title = title.trim();
        }

        if (description !== undefined) {
            task.description = description;
        }

        if (status !== undefined) {
            task.status = status;
        }

        if (priority !== undefined) {
            task.priority = priority;
        }

        if (dueDate !== undefined) {
            if (new Date(dueDate) < new Date()) {
                return res.status(400).json({
                    message: "Due date cannot be in the past"
                });
            }

            task.dueDate = dueDate;
        }

        if (project !== undefined) {
            const {
                project: projectExists,
                assignableUserIds
            } =
                await getProjectAssignableUserIds(project);

            if (!projectExists) {
                return res.status(400).json({
                    message:
                        "Selected project does not exist"
                });
            }

            if (
                !canWorkInProject(
                    req.user,
                    projectExists,
                    assignableUserIds
                )
            ) {
                return res.status(403).json({
                    message:
                        "You can only move tasks into projects you belong to"
                });
            }

            task.project = project;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === "") {
                task.assignedTo = null;
            } else {
                const targetProjectId = project || task.project;
                const { assignableUserIds } =
                    await getProjectAssignableUserIds(targetProjectId);
                const assignedUser =
                    await User.findById(assignedTo);

                if (!assignedUser) {
                    return res.status(400).json({
                        message:
                            "Selected user does not exist"
                    });
                }

                if (assignedUser.role === "ADMIN") {
                    return res.status(400).json({
                        message:
                            "Tasks cannot be assigned to administrators"
                    });
                }

                if (
                    !assignableUserIds.has(assignedUser._id.toString())
                ) {
                    return res.status(400).json({
                        message:
                            "Tasks can only be assigned to people on the selected project"
                    });
                }

                task.assignedTo = assignedTo;
            }
        }

        await task.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("taskUpdated", {
                taskId: task._id.toString()
            });
        }

        res.status(200).json({
            message: "Task updated successfully",
            task
        });
    } catch (error) {
        console.error("Update task error:", error);

        res.status(500).json({
            message: "Failed to update task"
        });
    }
};

const deleteTask = async (req, res) => {
    try {
        const taskId = req.task._id.toString();

        await req.task.deleteOne();

        const io = req.app.get("io");

        if (io) {
            io.emit("taskDeleted", {
                taskId
            });
        }

        res.status(200).json({
            message: "Task deleted successfully"
        });
    } catch (error) {
        console.error("Delete task error:", error);

        res.status(500).json({
            message: "Failed to delete task"
        });
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
};

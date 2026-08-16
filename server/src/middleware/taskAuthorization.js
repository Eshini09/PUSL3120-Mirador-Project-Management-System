const Task = require("../models/Task");

const checkTaskAccess = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        // Administrators can manage any task.
        if (req.user.role === "ADMIN") {
            req.task = task;
            return next();
        }

        // Project managers can manage tasks assigned to their projects.
        if (req.user.role === "PROJECT_MANAGER") {
            const Project = require("../models/Project");
            const project = await Project.findById(task.project);

            if (
                project &&
                project.manager.toString() === req.user.userId
            ) {
                req.task = task;
                return next();
            }
        }

        // Team members can manage tasks assigned to themselves.
        if (
            req.user.role === "TEAM_MEMBER" &&
            task.assignedTo &&
            task.assignedTo.toString() === req.user.userId
        ) {
            req.task = task;
            return next();
        }

        return res.status(403).json({
            message: "You are not authorized to manage this task"
        });
    } catch (error) {
        console.error("Task authorization error:", error);

        return res.status(500).json({
            message: "Failed to authorize task access"
        });
    }
};

module.exports = checkTaskAccess;
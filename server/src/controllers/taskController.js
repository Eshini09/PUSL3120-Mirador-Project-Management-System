const Task = require("../models/Task");

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

        const task = await Task.create({
            title,
            description,
            status,
            priority,
            dueDate,
            project,
            assignedTo,
            createdBy: req.user.userId
        });

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
        const tasks = await Task.find()
            .populate("project", "name status")
            .populate("assignedTo", "name email role")
            .populate("createdBy", "name email role")
            .sort({ createdAt: -1 });

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
            .populate("project", "name status")
            .populate("assignedTo", "name email role")
            .populate("createdBy", "name email role");

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        res.status(200).json({
            task
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

        if (title !== undefined) {
            task.title = title;
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
            task.dueDate = dueDate;
        }

        if (project !== undefined) {
            task.project = project;
        }

        if (assignedTo !== undefined) {
            task.assignedTo = assignedTo;
        }

        await task.save();

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
        await req.task.deleteOne();

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
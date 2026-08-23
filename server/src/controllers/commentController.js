const TaskComment = require("../models/TaskComment");
const Task = require("../models/Task");
const Project = require("../models/Project");
const Team = require("../models/Team");

const canAccessTask = async (task, user) => {
    if (user.role === "ADMIN") {
        return true;
    }

    if (
        user.role === "TEAM_MEMBER" &&
        task.assignedTo &&
        task.assignedTo.toString() === user.userId
    ) {
        return true;
    }

    const project = await Project.findById(task.project);

    return (
        project &&
        project.manager.toString() === user.userId
    );
};

const getComments = async (req, res) => {
    try {
        let tasks;

        if (req.user.role === "ADMIN") {
            tasks = await Task.find().select("_id");
        } else {
            const teams = await Team.find({
                $or: [
                    { owner: req.user.userId },
                    { members: req.user.userId }
                ]
            }).select("_id");

            const projects = await Project.find({
                $or: [
                    { manager: req.user.userId },
                    { members: req.user.userId },
                    { teams: { $in: teams.map((team) => team._id) } }
                ]
            }).select("_id");

            tasks = await Task.find({
                $or: [
                    {
                        project: {
                            $in: projects.map(
                                (project) => project._id
                            )
                        }
                    },
                    { assignedTo: req.user.userId }
                ]
            }).select("_id");
        }

        const comments = await TaskComment.find({
            task: {
                $in: tasks.map((task) => task._id)
            }
        })
            .populate("author", "name email role")
            .populate("task", "title status project")
            .sort({ createdAt: 1 });

        res.status(200).json({
            comments
        });
    } catch (error) {
        console.error("Get comments error:", error);

        res.status(500).json({
            message: "Failed to retrieve comments"
        });
    }
};

const createComment = async (req, res) => {
    try {
        const { body, task } = req.body;

        if (!body || !task) {
            return res.status(400).json({
                message: "Comment body and task are required"
            });
        }

        const taskRecord = await Task.findById(task);

        if (!taskRecord) {
            return res.status(400).json({
                message: "Selected task does not exist"
            });
        }

        const hasAccess = await canAccessTask(taskRecord, req.user);

        if (!hasAccess) {
            return res.status(403).json({
                message: "You are not authorized to comment on this task"
            });
        }

        const comment = await TaskComment.create({
            body: body.trim(),
            task,
            author: req.user.userId
        });

        const io = req.app.get("io");

        if (io) {
            io.emit("commentCreated", {
                commentId: comment._id.toString(),
                taskId: task.toString()
            });
        }

        res.status(201).json({
            message: "Comment created successfully",
            comment
        });
    } catch (error) {
        console.error("Create comment error:", error);

        res.status(500).json({
            message: "Failed to create comment"
        });
    }
};

const updateComment = async (req, res) => {
    try {
        const { body } = req.body;
        const comment = await TaskComment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        if (
            req.user.role !== "ADMIN" &&
            comment.author.toString() !== req.user.userId
        ) {
            return res.status(403).json({
                message: "You are not authorized to update this comment"
            });
        }

        if (!body || !body.trim()) {
            return res.status(400).json({
                message: "Comment body cannot be empty"
            });
        }

        comment.body = body.trim();
        await comment.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("commentUpdated", {
                commentId: comment._id.toString(),
                taskId: comment.task.toString()
            });
        }

        res.status(200).json({
            message: "Comment updated successfully",
            comment
        });
    } catch (error) {
        console.error("Update comment error:", error);

        res.status(500).json({
            message: "Failed to update comment"
        });
    }
};

const deleteComment = async (req, res) => {
    try {
        const comment = await TaskComment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        if (
            req.user.role !== "ADMIN" &&
            comment.author.toString() !== req.user.userId
        ) {
            return res.status(403).json({
                message: "You are not authorized to delete this comment"
            });
        }

        const commentId = comment._id.toString();
        const taskId = comment.task.toString();

        await comment.deleteOne();

        const io = req.app.get("io");

        if (io) {
            io.emit("commentDeleted", {
                commentId,
                taskId
            });
        }

        res.status(200).json({
            message: "Comment deleted successfully"
        });
    } catch (error) {
        console.error("Delete comment error:", error);

        res.status(500).json({
            message: "Failed to delete comment"
        });
    }
};

module.exports = {
    getComments,
    createComment,
    updateComment,
    deleteComment
};

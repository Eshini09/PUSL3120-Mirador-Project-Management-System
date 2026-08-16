const Project = require("../models/Project");

const checkProjectManager = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        // Administrators can manage any project.
        if (req.user.role === "ADMIN") {
            req.project = project;
            return next();
        }

        // Project managers can only manage projects assigned to them.
        if (
            req.user.role === "PROJECT_MANAGER" &&
            project.manager.toString() === req.user.userId
        ) {
            req.project = project;
            return next();
        }

        return res.status(403).json({
            message: "You are not authorized to manage this project"
        });
    } catch (error) {
        console.error("Project authorization error:", error);

        return res.status(500).json({
            message: "Failed to authorize project access"
        });
    }
};

module.exports = checkProjectManager;
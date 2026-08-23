const Milestone = require("../models/Milestone");
const Project = require("../models/Project");

const checkMilestoneAccess = async (req, res, next) => {
    try {
        const milestone = await Milestone.findById(req.params.id);

        if (!milestone) {
            return res.status(404).json({
                message: "Milestone not found"
            });
        }

        if (req.user.role === "ADMIN") {
            req.milestone = milestone;
            return next();
        }

        const project = await Project.findById(milestone.project);

        if (
            project &&
            project.manager.toString() === req.user.userId
        ) {
            req.milestone = milestone;
            return next();
        }

        return res.status(403).json({
            message: "You are not authorized to manage this milestone"
        });
    } catch (error) {
        console.error("Milestone authorization error:", error);

        return res.status(500).json({
            message: "Failed to authorize milestone access"
        });
    }
};

module.exports = checkMilestoneAccess;

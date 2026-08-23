const Milestone = require("../models/Milestone");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const Team = require("../models/Team");

const getVisibleProjectIds = async (user) => {
    if (user.role === "ADMIN") {
        return null;
    }

    const assignedTasks = await Task.find({
        assignedTo: user.userId
    }).select("project");

    const teams = await Team.find({
        $or: [
            { owner: user.userId },
            { members: user.userId }
        ]
    }).select("_id");

    const visibleProjects = await Project.find({
        $or: [
            { manager: user.userId },
            { members: user.userId },
            { teams: { $in: teams.map((team) => team._id) } }
        ]
    }).select("_id");

    return [
        ...new Set(
            [
                ...assignedTasks.map((task) =>
                    task.project?.toString()
                ),
                ...visibleProjects.map((project) =>
                    project._id.toString()
                )
            ]
                .filter(Boolean)
        )
    ];
};

const validateProjectAccess = async (projectId, user) => {
    const project = await Project.findById(projectId).populate(
        "teams",
        "owner members"
    );

    if (!project) {
        return {
            error: "Selected project does not exist"
        };
    }

    if (user.role === "ADMIN") {
        return { project };
    }

    if (project.manager.toString() === user.userId) {
        return { project };
    }

    return {
        error: "You are not authorized to manage milestones for this project"
    };
};

const getProjectAssignableUserIds = (project) => {
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

    return assignableUserIds;
};

const validateOwner = async (owner, project) => {
    if (!owner) {
        return {};
    }

    const ownerUser = await User.findById(owner);

    if (!ownerUser) {
        return {
            error: "Selected milestone owner does not exist"
        };
    }

    if (ownerUser.role === "ADMIN") {
        return {
            error: "Milestones cannot be owned by administrators"
        };
    }

    if (
        project &&
        !getProjectAssignableUserIds(project).has(ownerUser._id.toString())
    ) {
        return {
            error:
                "Milestones can only be owned by people on the selected project"
        };
    }

    return { ownerUser };
};

const createMilestone = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            dueDate,
            project,
            owner
        } = req.body;

        if (!title || !project || !dueDate) {
            return res.status(400).json({
                message: "Milestone title, project and due date are required"
            });
        }

        const projectAccess = await validateProjectAccess(
            project,
            req.user
        );

        if (projectAccess.error) {
            return res.status(400).json({
                message: projectAccess.error
            });
        }

        const ownerValidation = await validateOwner(
            owner,
            projectAccess.project
        );

        if (ownerValidation.error) {
            return res.status(400).json({
                message: ownerValidation.error
            });
        }

        const projectDueDate = new Date(projectAccess.project.dueDate);
        const milestoneDueDate = new Date(dueDate);

        if (milestoneDueDate > projectDueDate) {
            return res.status(400).json({
                message: "Milestone due date cannot be after the project due date"
            });
        }

        const milestone = await Milestone.create({
            title: title.trim(),
            description,
            status,
            dueDate,
            project,
            owner: owner || null,
            createdBy: req.user.userId
        });

        const io = req.app.get("io");

        if (io) {
            io.emit("milestoneCreated", {
                milestoneId: milestone._id.toString()
            });
        }

        res.status(201).json({
            message: "Milestone created successfully",
            milestone
        });
    } catch (error) {
        console.error("Create milestone error:", error);

        res.status(500).json({
            message: "Failed to create milestone"
        });
    }
};

const getMilestones = async (req, res) => {
    try {
        const projectIds = await getVisibleProjectIds(req.user);

        const query = projectIds
            ? {
                  project: { $in: projectIds }
              }
            : {};

        const milestones = await Milestone.find(query)
            .populate("project", "name status dueDate manager")
            .populate("owner", "name email role")
            .populate("createdBy", "name email role")
            .sort({ dueDate: 1 });

        res.status(200).json({
            milestones
        });
    } catch (error) {
        console.error("Get milestones error:", error);

        res.status(500).json({
            message: "Failed to retrieve milestones"
        });
    }
};

const getMilestoneById = async (req, res) => {
    try {
        const milestone = await Milestone.findById(req.params.id)
            .populate("project", "name status dueDate manager")
            .populate("owner", "name email role")
            .populate("createdBy", "name email role");

        if (!milestone) {
            return res.status(404).json({
                message: "Milestone not found"
            });
        }

        if (req.user.role === "ADMIN") {
            return res.status(200).json({
                milestone
            });
        }

        if (milestone.project?.manager?.toString() === req.user.userId) {
            return res.status(200).json({
                milestone
            });
        }

        if (req.user.role === "TEAM_MEMBER") {
            const teams = await Team.find({
                $or: [
                    { owner: req.user.userId },
                    { members: req.user.userId }
                ]
            }).select("_id");

            const isProjectMember = await Project.exists({
                _id: milestone.project._id,
                $or: [
                    { members: req.user.userId },
                    { teams: { $in: teams.map((team) => team._id) } }
                ]
            });

            if (isProjectMember) {
                return res.status(200).json({
                    milestone
                });
            }

            const assignedTask = await Task.exists({
                project: milestone.project._id,
                assignedTo: req.user.userId
            });

            if (assignedTask) {
                return res.status(200).json({
                    milestone
                });
            }
        }

        return res.status(403).json({
            message: "You are not authorized to view this milestone"
        });
    } catch (error) {
        console.error("Get milestone error:", error);

        res.status(500).json({
            message: "Failed to retrieve milestone"
        });
    }
};

const updateMilestone = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            dueDate,
            project,
            owner
        } = req.body;

        const milestone = req.milestone;
        const targetProjectId = project || milestone.project;
        const projectAccess = await validateProjectAccess(
            targetProjectId,
            req.user
        );

        if (projectAccess.error) {
            return res.status(400).json({
                message: projectAccess.error
            });
        }

        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({
                    message: "Milestone title cannot be empty"
                });
            }

            milestone.title = title.trim();
        }

        if (description !== undefined) {
            milestone.description = description;
        }

        if (status !== undefined) {
            milestone.status = status;
        }

        if (dueDate !== undefined) {
            const projectDueDate = new Date(projectAccess.project.dueDate);
            const milestoneDueDate = new Date(dueDate);

            if (milestoneDueDate > projectDueDate) {
                return res.status(400).json({
                    message:
                        "Milestone due date cannot be after the project due date"
                });
            }

            milestone.dueDate = dueDate;
        }

        if (project !== undefined) {
            milestone.project = project;
        }

        if (owner !== undefined) {
            if (owner === "") {
                milestone.owner = null;
            } else {
                const ownerValidation = await validateOwner(
                    owner,
                    projectAccess.project
                );

                if (ownerValidation.error) {
                    return res.status(400).json({
                        message: ownerValidation.error
                    });
                }

                milestone.owner = owner;
            }
        }

        await milestone.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("milestoneUpdated", {
                milestoneId: milestone._id.toString()
            });
        }

        res.status(200).json({
            message: "Milestone updated successfully",
            milestone
        });
    } catch (error) {
        console.error("Update milestone error:", error);

        res.status(500).json({
            message: "Failed to update milestone"
        });
    }
};

const deleteMilestone = async (req, res) => {
    try {
        const milestoneId = req.milestone._id.toString();

        await req.milestone.deleteOne();

        const io = req.app.get("io");

        if (io) {
            io.emit("milestoneDeleted", {
                milestoneId
            });
        }

        res.status(200).json({
            message: "Milestone deleted successfully"
        });
    } catch (error) {
        console.error("Delete milestone error:", error);

        res.status(500).json({
            message: "Failed to delete milestone"
        });
    }
};

module.exports = {
    createMilestone,
    getMilestones,
    getMilestoneById,
    updateMilestone,
    deleteMilestone
};

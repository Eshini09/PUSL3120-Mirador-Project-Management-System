const Team = require("../models/Team");
const User = require("../models/User");

const normalizeMembers = (members, ownerId) => [
    ...new Set([
        ownerId,
        ...(Array.isArray(members) ? members.filter(Boolean) : [])
    ])
];

const validateMembers = async (memberIds) => {
    const users = await User.find({
        _id: { $in: memberIds }
    });

    return users.length === memberIds.length;
};

const createTeam = async (req, res) => {
    try {
        const { name, description, members = [] } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Team name is required"
            });
        }

        const memberIds = normalizeMembers(
            members,
            req.user.userId
        );

        const membersAreValid = await validateMembers(memberIds);

        if (!membersAreValid) {
            return res.status(400).json({
                message: "One or more selected team members do not exist"
            });
        }

        const team = await Team.create({
            name: name.trim(),
            description,
            owner: req.user.userId,
            members: memberIds
        });

        const io = req.app.get("io");

        if (io) {
            io.emit("teamCreated", {
                teamId: team._id.toString()
            });
        }

        res.status(201).json({
            message: "Team created successfully",
            team
        });
    } catch (error) {
        console.error("Create team error:", error);

        res.status(500).json({
            message: "Failed to create team"
        });
    }
};

const getTeams = async (req, res) => {
    try {
        const query =
            req.user.role === "ADMIN"
                ? {}
                : {
                      $or: [
                          { owner: req.user.userId },
                          { members: req.user.userId }
                      ]
                  };

        const teams = await Team.find(query)
            .populate("owner", "name email role")
            .populate("members", "name email role")
            .sort({ createdAt: -1 });

        res.status(200).json({
            teams
        });
    } catch (error) {
        console.error("Get teams error:", error);

        res.status(500).json({
            message: "Failed to retrieve teams"
        });
    }
};

const updateTeam = async (req, res) => {
    try {
        const { name, description, members } = req.body;
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        const canManage =
            req.user.role === "ADMIN" ||
            team.owner.toString() === req.user.userId;

        if (!canManage) {
            return res.status(403).json({
                message: "You are not authorized to manage this team"
            });
        }

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: "Team name cannot be empty"
                });
            }

            team.name = name.trim();
        }

        if (description !== undefined) {
            team.description = description;
        }

        if (members !== undefined) {
            const memberIds = normalizeMembers(
                members,
                team.owner.toString()
            );

            const membersAreValid = await validateMembers(memberIds);

            if (!membersAreValid) {
                return res.status(400).json({
                    message:
                        "One or more selected team members do not exist"
                });
            }

            team.members = memberIds;
        }

        await team.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("teamUpdated", {
                teamId: team._id.toString()
            });
        }

        res.status(200).json({
            message: "Team updated successfully",
            team
        });
    } catch (error) {
        console.error("Update team error:", error);

        res.status(500).json({
            message: "Failed to update team"
        });
    }
};

const deleteTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        const canManage =
            req.user.role === "ADMIN" ||
            team.owner.toString() === req.user.userId;

        if (!canManage) {
            return res.status(403).json({
                message: "You are not authorized to delete this team"
            });
        }

        const teamId = team._id.toString();
        await team.deleteOne();

        const io = req.app.get("io");

        if (io) {
            io.emit("teamDeleted", {
                teamId
            });
        }

        res.status(200).json({
            message: "Team deleted successfully"
        });
    } catch (error) {
        console.error("Delete team error:", error);

        res.status(500).json({
            message: "Failed to delete team"
        });
    }
};

const removeTeamMember = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        const canManage =
            req.user.role === "ADMIN" ||
            team.owner.toString() === req.user.userId;

        if (!canManage) {
            return res.status(403).json({
                message: "You are not authorized to manage this team"
            });
        }

        if (team.owner.toString() === req.params.userId) {
            return res.status(400).json({
                message: "The team owner cannot be removed"
            });
        }

        team.members = team.members.filter(
            (member) => member.toString() !== req.params.userId
        );

        await team.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("teamUpdated", {
                teamId: team._id.toString()
            });
        }

        res.status(200).json({
            message: "Team member removed successfully",
            team
        });
    } catch (error) {
        console.error("Remove team member error:", error);

        res.status(500).json({
            message: "Failed to remove team member"
        });
    }
};

module.exports = {
    createTeam,
    getTeams,
    updateTeam,
    deleteTeam,
    removeTeamMember
};

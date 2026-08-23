const crypto = require("crypto");

const Project = require("../models/Project");
const Team = require("../models/Team");
const TeamInvite = require("../models/TeamInvite");

const canManageTeam = (team, user) =>
    user.role === "ADMIN" ||
    team.owner.toString() === user.userId;

const createTeamInvite = async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        if (!canManageTeam(team, req.user)) {
            return res.status(403).json({
                message: "You are not authorized to invite people to this team"
            });
        }

        let invite = await TeamInvite.findOne({
            team: team._id,
            status: "OPEN"
        });

        const createdNewInvite = !invite;

        if (!invite) {
            invite = await TeamInvite.create({
                token: crypto.randomBytes(24).toString("hex"),
                team: team._id,
                createdBy: req.user.userId
            });
        }

        const io = req.app.get("io");

        if (io && createdNewInvite) {
            io.emit("teamInviteCreated", {
                teamId: team._id.toString(),
                inviteId: invite._id.toString()
            });
        }

        res.status(createdNewInvite ? 201 : 200).json({
            message: createdNewInvite
                ? "Team invite link created successfully"
                : "Active team invite link retrieved successfully",
            invite: {
                token: invite.token,
                team: invite.team,
                status: invite.status
            }
        });
    } catch (error) {
        console.error("Create team invite error:", error);

        res.status(500).json({
            message: "Failed to create team invite"
        });
    }
};

const getTeamInvites = async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        if (!canManageTeam(team, req.user)) {
            return res.status(403).json({
                message: "You are not authorized to view this team's invites"
            });
        }

        const invites = await TeamInvite.find({
            team: team._id
        })
            .populate("createdBy", "name email role")
            .populate("acceptedBy", "name email role")
            .populate("declinedBy", "name email role")
            .sort({ createdAt: -1 });

        res.status(200).json({
            invites
        });
    } catch (error) {
        console.error("Get team invites error:", error);

        res.status(500).json({
            message: "Failed to retrieve team invites"
        });
    }
};

const getTeamInvite = async (req, res) => {
    try {
        const invite = await TeamInvite.findOne({
            token: req.params.token,
            status: "OPEN"
        })
            .populate("team", "name description owner members")
            .populate("createdBy", "name email role");

        if (!invite) {
            return res.status(404).json({
                message: "Invite link not found or closed"
            });
        }

        res.status(200).json({
            invite
        });
    } catch (error) {
        console.error("Get team invite error:", error);

        res.status(500).json({
            message: "Failed to retrieve team invite"
        });
    }
};

const acceptTeamInvite = async (req, res) => {
    try {
        const invite = await TeamInvite.findOne({
            token: req.params.token,
            status: "OPEN"
        });

        if (!invite) {
            return res.status(404).json({
                message: "Invite link not found or closed"
            });
        }

        const team = await Team.findById(invite.team);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        const userId = req.user.userId;

        if (!team.members.some((member) => member.toString() === userId)) {
            team.members.push(userId);
            await team.save();
        }

        invite.acceptedBy = [
            ...new Set([
                ...invite.acceptedBy.map((member) => member.toString()),
                userId
            ])
        ];
        invite.declinedBy = invite.declinedBy.filter(
            (member) => member.toString() !== userId
        );
        await invite.save();

        const linkedProjects = await Project.find({
            teams: team._id
        })
            .select("name status dueDate manager teams members")
            .populate("manager", "name email role")
            .populate("members", "name email role")
            .populate({
                path: "teams",
                select: "name description owner members",
                populate: [
                    {
                        path: "owner",
                        select: "name email role"
                    },
                    {
                        path: "members",
                        select: "name email role"
                    }
                ]
            });

        const io = req.app.get("io");

        if (io) {
            io.emit("teamUpdated", {
                teamId: team._id.toString()
            });
            io.emit("teamInviteUpdated", {
                teamId: team._id.toString(),
                inviteId: invite._id.toString()
            });
            linkedProjects.forEach((project) => {
                io.emit("projectUpdated", {
                    projectId: project._id.toString()
                });
            });
        }

        res.status(200).json({
            message: "Team invitation accepted successfully",
            team,
            projects: linkedProjects
        });
    } catch (error) {
        console.error("Accept team invite error:", error);

        res.status(500).json({
            message: "Failed to accept team invite"
        });
    }
};

const declineTeamInvite = async (req, res) => {
    try {
        const invite = await TeamInvite.findOne({
            token: req.params.token,
            status: "OPEN"
        });

        if (!invite) {
            return res.status(404).json({
                message: "Invite link not found or closed"
            });
        }

        const userId = req.user.userId;

        invite.declinedBy = [
            ...new Set([
                ...invite.declinedBy.map((member) => member.toString()),
                userId
            ])
        ];
        invite.acceptedBy = invite.acceptedBy.filter(
            (member) => member.toString() !== userId
        );
        await invite.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("teamInviteUpdated", {
                teamId: invite.team.toString(),
                inviteId: invite._id.toString()
            });
        }

        res.status(200).json({
            message: "Team invitation declined"
        });
    } catch (error) {
        console.error("Decline team invite error:", error);

        res.status(500).json({
            message: "Failed to decline team invite"
        });
    }
};

const closeTeamInvite = async (req, res) => {
    try {
        const invite = await TeamInvite.findOne({
            token: req.params.token
        });

        if (!invite) {
            return res.status(404).json({
                message: "Invite link not found"
            });
        }

        const team = await Team.findById(invite.team);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        if (!canManageTeam(team, req.user)) {
            return res.status(403).json({
                message: "You are not authorized to close this invite"
            });
        }

        invite.status = "CLOSED";
        await invite.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("teamInviteUpdated", {
                teamId: team._id.toString(),
                inviteId: invite._id.toString()
            });
        }

        res.status(200).json({
            message: "Invite link revoked successfully"
        });
    } catch (error) {
        console.error("Close team invite error:", error);

        res.status(500).json({
            message: "Failed to revoke team invite"
        });
    }
};

module.exports = {
    createTeamInvite,
    getTeamInvites,
    getTeamInvite,
    acceptTeamInvite,
    declineTeamInvite,
    closeTeamInvite
};

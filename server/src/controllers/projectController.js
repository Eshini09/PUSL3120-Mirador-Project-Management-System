const Project = require("../models/Project");
const Task = require("../models/Task");
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

const populateProjectQuery = (query) =>
    query
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
        })
        .populate("createdBy", "name email role");

const validateUsableTeams = async (teamIds, user) => {
    const teamRecords = await Team.find({
        _id: { $in: teamIds }
    });

    if (teamRecords.length !== teamIds.length) {
        return {
            error: "One or more selected teams do not exist"
        };
    }

    if (user.role === "ADMIN") {
        return { teamRecords };
    }

    const unauthorizedTeam = teamRecords.find(
        (team) =>
            team.owner.toString() !== user.userId &&
            !team.members.some(
                (member) => member.toString() === user.userId
            )
    );

    if (unauthorizedTeam) {
        return {
            error:
                "You can only attach teams that you own or belong to"
        };
    }

    return { teamRecords };
};

const getTransferCandidateIds = async (project, memberIds, teamIds) => {
    const candidateIds = new Set([
        project.manager.toString(),
        ...memberIds.map((memberId) => memberId.toString())
    ]);

    const teamRecords = await Team.find({
        _id: { $in: teamIds }
    }).select("owner members");

    teamRecords.forEach((team) => {
        candidateIds.add(team.owner.toString());
        team.members.forEach((member) => {
            candidateIds.add(member.toString());
        });
    });

    return candidateIds;
};

const createProject = async (req, res) => {
    try {
        const {
            name,
            description,
            status,
            startDate,
            dueDate,
            manager: requestedManager = req.user.userId,
            members = [],
            teams = []
        } = req.body;
        const manager =
            req.user.role === "ADMIN"
                ? requestedManager
                : req.user.userId;

        if (
            !name ||
            !description ||
            !startDate ||
            !dueDate
        ) {
            return res.status(400).json({
                message: "All required project fields must be provided"
            });
        }

        const managerUser = await User.findById(manager);

        if (!managerUser) {
            return res.status(400).json({
                message: "Selected project manager does not exist"
            });
        }

        if (new Date(dueDate) < new Date(startDate)) {
            return res.status(400).json({
                message: "Due date cannot be before the start date"
            });
        }

        const memberIds = Array.isArray(members)
            ? members.filter(Boolean)
            : [];

        const memberUsers = await User.find({
            _id: { $in: memberIds }
        });

        if (memberUsers.length !== memberIds.length) {
            return res.status(400).json({
                message: "One or more selected project members do not exist"
            });
        }

        const teamIds = Array.isArray(teams)
            ? teams.filter(Boolean)
            : [];

        const teamValidation = await validateUsableTeams(
            teamIds,
            req.user
        );

        if (teamValidation.error) {
            return res.status(400).json({
                message: teamValidation.error
            });
        }

        const project = await Project.create({
            name: name.trim(),
            description: description.trim(),
            status,
            startDate,
            dueDate,
            manager,
            members: memberIds,
            teams: teamIds,
            createdBy: req.user.userId
        });

        const io = req.app.get("io");

        if (io) {
            io.emit("projectCreated", {
                projectId: project._id.toString()
            });
        }

        res.status(201).json({
            message: "Project created successfully",
            project
        });
    } catch (error) {
        console.error("Create project error:", error);

        res.status(500).json({
            message: "Failed to create project"
        });
    }
};

const getProjects = async (req, res) => {
    try {
        let projects;

        const teamIds = await getUserTeamIds(req.user);

        if (req.user.role === "ADMIN") {
            projects = await populateProjectQuery(Project.find())
                .sort({ createdAt: -1 });
        } else if (req.user.role === "PROJECT_MANAGER") {
            projects = await populateProjectQuery(Project.find({
                $or: [
                    { manager: req.user.userId },
                    { members: req.user.userId },
                    { teams: { $in: teamIds } }
                ]
            }))
                .sort({ createdAt: -1 });
        } else {
            const assignedTasks = await Task.find({
                assignedTo: req.user.userId
            }).select("project");

            const projectIds = [
                ...new Set(
                    assignedTasks
                        .map((task) => task.project?.toString())
                        .filter(Boolean)
                )
            ];

            projects = await populateProjectQuery(Project.find({
                $or: [
                    { manager: req.user.userId },
                    { _id: { $in: projectIds } },
                    { members: req.user.userId },
                    { teams: { $in: teamIds } }
                ]
            }))
                .sort({ createdAt: -1 });
        }

        res.status(200).json({
            projects
        });
    } catch (error) {
        console.error("Get projects error:", error);

        res.status(500).json({
            message: "Failed to retrieve projects"
        });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await populateProjectQuery(
            Project.findById(req.params.id)
        );

        if (!project) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        if (req.user.role === "ADMIN") {
            return res.status(200).json({
                project
            });
        }

        if (
            project.manager &&
            project.manager._id.toString() === req.user.userId
        ) {
            return res.status(200).json({
                project
            });
        }

        const isProjectMember = project.members.some(
            (member) => member._id.toString() === req.user.userId
        );

        const isProjectTeamMember = project.teams.some((team) =>
            team.members.some(
                (member) =>
                    (member._id?.toString() || member.toString()) ===
                    req.user.userId
            )
        );

        if (isProjectMember || isProjectTeamMember) {
            return res.status(200).json({
                project
            });
        }

        const assignedTask = await Task.exists({
            project: project._id,
            assignedTo: req.user.userId
        });

        if (assignedTask) {
            return res.status(200).json({
                project
            });
        }

        return res.status(403).json({
            message: "You are not authorized to view this project"
        });
    } catch (error) {
        console.error("Get project error:", error);

        res.status(500).json({
            message: "Failed to retrieve project"
        });
    }
};

const updateProject = async (req, res) => {
    try {
        const {
            name,
            description,
            status,
            startDate,
            dueDate,
            manager,
            members,
            teams
        } = req.body;

        const project = req.project;

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: "Project name cannot be empty"
                });
            }

            project.name = name.trim();
        }

        if (description !== undefined) {
            if (!description.trim()) {
                return res.status(400).json({
                    message: "Project description cannot be empty"
                });
            }

            project.description = description.trim();
        }

        const newStartDate =
            startDate !== undefined
                ? new Date(startDate)
                : project.startDate;

        const newDueDate =
            dueDate !== undefined
                ? new Date(dueDate)
                : project.dueDate;

        if (newDueDate < newStartDate) {
            return res.status(400).json({
                message: "Due date cannot be before the start date"
            });
        }

        if (status !== undefined) {
            project.status = status;
        }

        if (startDate !== undefined) {
            project.startDate = startDate;
        }

        if (dueDate !== undefined) {
            project.dueDate = dueDate;
        }

        const nextMemberIds =
            members !== undefined
                ? Array.isArray(members)
                    ? members.filter(Boolean)
                    : []
                : project.members.map((member) => member.toString());

        const nextTeamIds =
            teams !== undefined
                ? Array.isArray(teams)
                    ? teams.filter(Boolean)
                    : []
                : project.teams.map((team) => team.toString());

        if (manager !== undefined) {
            const managerUser = await User.findById(manager);

            if (!managerUser) {
                return res.status(400).json({
                    message: "Selected project manager does not exist"
                });
            }

            if (managerUser.role === "ADMIN") {
                return res.status(400).json({
                    message:
                        "Projects should be managed by a project participant, not an administrator"
                });
            }

            const transferCandidateIds = await getTransferCandidateIds(
                project,
                nextMemberIds,
                nextTeamIds
            );

            if (!transferCandidateIds.has(managerUser._id.toString())) {
                return res.status(400).json({
                    message:
                        "Project ownership can only be transferred to someone on this project"
                });
            }

            project.manager = manager;
        }

        if (members !== undefined) {
            const memberIds = Array.isArray(members)
                ? members.filter(Boolean)
                : [];

            const memberUsers = await User.find({
                _id: { $in: memberIds }
            });

            if (memberUsers.length !== memberIds.length) {
                return res.status(400).json({
                    message:
                        "One or more selected project members do not exist"
                });
            }

            project.members = memberIds;
        }

        if (teams !== undefined) {
            const teamIds = Array.isArray(teams)
                ? teams.filter(Boolean)
                : [];

            const teamValidation = await validateUsableTeams(
                teamIds,
                req.user
            );

            if (teamValidation.error) {
                return res.status(400).json({
                    message: teamValidation.error
                });
            }

            project.teams = teamIds;
        }

        await project.save();

        const io = req.app.get("io");

        if (io) {
            io.emit("projectUpdated", {
                projectId: project._id.toString()
            });
        }

        res.status(200).json({
            message: "Project updated successfully",
            project
        });
    } catch (error) {
        console.error("Update project error:", error);

        res.status(500).json({
            message: "Failed to update project"
        });
    }
};

const deleteProject = async (req, res) => {
    try {
        const projectId = req.project._id.toString();

        await req.project.deleteOne();

        const io = req.app.get("io");

        if (io) {
            io.emit("projectDeleted", {
                projectId
            });
        }

        res.status(200).json({
            message: "Project deleted successfully"
        });
    } catch (error) {
        console.error("Delete project error:", error);

        res.status(500).json({
            message: "Failed to delete project"
        });
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject
};

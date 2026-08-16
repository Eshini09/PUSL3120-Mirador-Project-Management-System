const Project = require("../models/Project");

const createProject = async (req, res) => {
    try {
        const {
            name,
            description,
            status,
            startDate,
            dueDate,
            manager
        } = req.body;

        const project = await Project.create({
            name,
            description,
            status,
            startDate,
            dueDate,
            manager,
            createdBy: req.user.userId
        });

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
        const projects = await Project.find()
            .populate("manager", "name email role")
            .populate("createdBy", "name email role")
            .sort({ createdAt: -1 });

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
        const project = await Project.findById(req.params.id)
            .populate("manager", "name email role")
            .populate("createdBy", "name email role");

        if (!project) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        res.status(200).json({
            project
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
            manager
        } = req.body;

        const project = req.project;

        if (name !== undefined) {
            project.name = name;
        }

        if (description !== undefined) {
            project.description = description;
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

        if (manager !== undefined) {
            project.manager = manager;
        }

        await project.save();

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
        await req.project.deleteOne();

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
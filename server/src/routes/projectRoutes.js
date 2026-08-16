const express = require("express");

const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject
} = require("../controllers/projectController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorizeMiddleware");
const checkProjectManager = require("../middleware/projectAuthorization");

const router = express.Router();

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "PROJECT_MANAGER"),
    createProject
);

router.get(
    "/",
    authenticate,
    getProjects
);

router.get(
    "/:id",
    authenticate,
    getProjectById
);

router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "PROJECT_MANAGER"),
    checkProjectManager,
    updateProject
);

router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "PROJECT_MANAGER"),
    checkProjectManager,
    deleteProject
);

module.exports = router;
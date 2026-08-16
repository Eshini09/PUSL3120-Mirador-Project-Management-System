const express = require("express");

const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
} = require("../controllers/taskController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorizeMiddleware");
const checkTaskAccess = require("../middleware/taskAuthorization");

const router = express.Router();

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "PROJECT_MANAGER"),
    createTask
);

router.get(
    "/",
    authenticate,
    getTasks
);

router.get(
    "/:id",
    authenticate,
    getTaskById
);

router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"),
    checkTaskAccess,
    updateTask
);

router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"),
    checkTaskAccess,
    deleteTask
);

module.exports = router;
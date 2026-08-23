const express = require("express");

const {
    getUsers,
    getAssignableUsers,
    updateMyProfile,
    updateUserRole,
    deleteUser
} = require("../controllers/userController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorizeMiddleware");

const router = express.Router();

router.get(
    "/assignable",
    authenticate,
    getAssignableUsers
);

router.patch(
    "/me",
    authenticate,
    updateMyProfile
);

router.get(
    "/",
    authenticate,
    authorize("ADMIN"),
    getUsers
);

router.patch(
    "/:id/role",
    authenticate,
    authorize("ADMIN"),
    updateUserRole
);

router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    deleteUser
);

module.exports = router;

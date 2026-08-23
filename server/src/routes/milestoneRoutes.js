const express = require("express");

const {
    createMilestone,
    getMilestones,
    getMilestoneById,
    updateMilestone,
    deleteMilestone
} = require("../controllers/milestoneController");

const authenticate = require("../middleware/authMiddleware");
const checkMilestoneAccess = require("../middleware/milestoneAuthorization");

const router = express.Router();

router.post(
    "/",
    authenticate,
    createMilestone
);

router.get(
    "/",
    authenticate,
    getMilestones
);

router.get(
    "/:id",
    authenticate,
    getMilestoneById
);

router.put(
    "/:id",
    authenticate,
    checkMilestoneAccess,
    updateMilestone
);

router.delete(
    "/:id",
    authenticate,
    checkMilestoneAccess,
    deleteMilestone
);

module.exports = router;

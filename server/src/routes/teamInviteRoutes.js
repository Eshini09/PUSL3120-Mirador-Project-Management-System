const express = require("express");

const {
    createTeamInvite,
    getTeamInvites,
    getTeamInvite,
    acceptTeamInvite,
    declineTeamInvite,
    closeTeamInvite
} = require("../controllers/teamInviteController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/teams/:teamId/invites", authenticate, createTeamInvite);
router.get("/teams/:teamId/invites", authenticate, getTeamInvites);
router.get("/team-invites/:token", getTeamInvite);
router.post("/team-invites/:token/accept", authenticate, acceptTeamInvite);
router.post("/team-invites/:token/decline", authenticate, declineTeamInvite);
router.patch("/team-invites/:token/close", authenticate, closeTeamInvite);

module.exports = router;

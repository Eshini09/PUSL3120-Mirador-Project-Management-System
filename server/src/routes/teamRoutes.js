const express = require("express");

const {
    createTeam,
    getTeams,
    updateTeam,
    deleteTeam,
    removeTeamMember
} = require("../controllers/teamController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authenticate, createTeam);
router.get("/", authenticate, getTeams);
router.put("/:id", authenticate, updateTeam);
router.delete("/:id/members/:userId", authenticate, removeTeamMember);
router.delete("/:id", authenticate, deleteTeam);

module.exports = router;

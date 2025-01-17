const express = require("express");
const router = express.Router();
const searchController = require("../controller/search.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get("/leaderboard", searchController.getLeaderboard);

module.exports = router;

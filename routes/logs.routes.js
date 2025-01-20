const express = require("express");
const router = express.Router();
const logsController = require("../controller/logs.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get(
  "/searchUserAccount",
  authMiddleware.authUser,
  logsController.searchUserAccount
);

router.get(
  "/searchTransaction",
  authMiddleware.authUser,
  logsController.searchTransaction
);

module.exports = router;

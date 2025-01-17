const express = require("express");
const router = express.Router();
const userController = require("../controller/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/register", userController.createUser);

router.get("/all", authMiddleware.authUser, userController.getAllUsers);

router.get("/role", authMiddleware.authUser, userController.getUserRole);

module.exports = router;

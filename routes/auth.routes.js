const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authController = require("../controller/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post(
  "/register",
  [body("username"), body("password")],
  authController.registerUser
);

router.post(
  "/login",
  [body("username"), body("password")],
  authController.loginUser
);

router.get("/logout", authMiddleware.authUser, authController.logoutUser);

router.get("/role", authMiddleware.authUser, authController.getRole);

module.exports = router;

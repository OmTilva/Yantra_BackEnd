const userModel = require("../models/user.model");
const authService = require("../services/auth.service");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

module.exports.registerUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  const isUserExists = await userModel.findOne({ username });
  if (isUserExists) {
    res.status(400).json({ message: "User already exists" });
  }

  const hashPassword = await userModel.hashPassword(password);

  const user = await authService.createUser({
    username,
    password: hashPassword,
  });
  const token = user.generateAuthToken();
  res.status(201).json({ token, user });
};

module.exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await userModel.findOne({ username }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    if (user.isLoggedIn) {
      return res.status(403).json({
        message:
          "You're already logged in, mate! Quit messing around before things get real ugly.",
        alert: true,
      });
    }

    user.isLoggedIn = true;
    await user.save();

    const token = user.generateAuthToken();

    res
      .status(200)
      .json({ token, user: { username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.logoutUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isLoggedIn = false;
    await user.save();

    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getRole = async (req, res, next) => {
  try {
    const user = req.user;
    res.status(200).json({ role: user.role });
  } catch (error) {
    res.status(500).json({ message: "Error fetching role" });
  }
};

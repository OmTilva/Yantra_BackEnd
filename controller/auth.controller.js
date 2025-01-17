const userModel = require("../models/user.model");
const authService = require("../services/auth.service");
const { validationResult } = require("express-validator");

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

module.exports.loginUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, password } = req.body;
  const user = await userModel.findOne({ username }).select("+password");
  if (!user) {
    return res.status(401).json({ message: "invalid username or password" });
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid Username or Password" });
  }
  const token = user.generateAuthToken();
  res.cookie("token", token);
  res.status(200).json({ token, user });
};

module.exports.logoutUser = async (req, res, next) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
};

module.exports.getRole = async (req, res, next) => {
  try {
    const user = req.user;
    res.status(200).json({ role: user.role });
  } catch (error) {
    res.status(500).json({ message: "Error fetching role" });
  }
};

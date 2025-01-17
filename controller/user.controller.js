const userModel = require("../models/user.model");

module.exports.createUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const existingUser = await userModel.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Hash password
    const hashedPassword = await userModel.hashPassword(password);

    // Create user with default balance
    const user = await userModel.create({
      username,
      password: hashedPassword,
      balance: 1000000, // 10 lakhs
    });

    const token = user.generateAuthToken();
    res.status(201).json({
      token,
      user: { username: user.username, balance: user.balance },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getAllUsers = async (req, res) => {
  try {
    // Check if user is admin or banker
    if (!["admin", "banker"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const users = await userModel.find({}, "username balance role portfolio");

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getUserRole = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ role: user.role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const userModel = require("../models/user.model");
const brokerHouseModel = require("../models/brokerHouse.model");

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

module.exports.updateUserRole = async (req, res) => {
  try {
    const { userId, role, brokerHouseName } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Check if role is valid
    if (!["user", "jobber", "banker", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If changing role to jobber, set brokerHouse to the provided brokerHouseName or null
    if (role === "jobber") {
      if (brokerHouseName) {
        const brokerHouse = await brokerHouseModel.findOne({
          name: brokerHouseName,
        });
        if (!brokerHouse) {
          return res.status(404).json({ message: "BrokerHouse not found" });
        }
        user.brokerHouse = brokerHouse._id;

        // Add jobber to broker house
        brokerHouse.jobbers.push(user._id);
        await brokerHouse.save();
      } else {
        user.brokerHouse = null;
      }
    } else {
      user.brokerHouse = null; // Clear brokerHouse if role is not jobber
    }

    user.role = role;
    await user.save();

    res.status(200).json({ message: "User role updated successfully" });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports.getUserDetails = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id).populate("brokerHouse");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const Manipulator = require("../models/manipulator.model");

exports.addManipulator = async (req, res) => {
  try {
    const value = 20.6; // Value to be added
    const manipulator = new Manipulator({ value });
    await manipulator.save();
    res
      .status(201)
      .json({ message: "Manipulator value added successfully", manipulator });
  } catch (error) {
    res.status(500).json({
      message: "Error adding manipulator value",
      error: error.message,
    });
  }
};

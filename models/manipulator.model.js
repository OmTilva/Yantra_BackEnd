const mongoose = require("mongoose");

const manipulatorSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true,
    default: 900000,
  },
});

const Manipulator = mongoose.model("Manipulator", manipulatorSchema);

module.exports = Manipulator;

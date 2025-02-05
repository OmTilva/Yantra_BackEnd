const mongoose = require("mongoose");

const manipulatorSchema = new mongoose.Schema({
  value: {
    type: Number,
    default: 20.6,
    required: true,
  },
});

const Manipulator = mongoose.model("Manipulator", manipulatorSchema);

module.exports = Manipulator;

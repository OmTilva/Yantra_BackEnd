const mongoose = require("mongoose");

const brokerHouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  brokerage: {
    type: Number,
    required: true,
  },
  jobbers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

const BrokerHouse = mongoose.model("BrokerHouse", brokerHouseSchema);

module.exports = BrokerHouse;

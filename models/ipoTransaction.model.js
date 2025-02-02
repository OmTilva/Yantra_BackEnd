const mongoose = require("mongoose");

const ipoTransactionSchema = new mongoose.Schema({
  transactionID: {
    type: String,
    required: true,
    unique: true,
  },
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  stockID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stock",
    required: true,
  },
  adminID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lots: {
    type: Number,
    required: true,
  },
  allottedUnits: {
    type: Number,
    required: true,
  },
  pricePerUnit: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["ALLOTTED", "REJECTED"],
    required: true,
  },
  transactionDate: {
    type: Date,
    default: Date.now,
  },
});

const ipoTransaction = mongoose.model("ipoTransaction", ipoTransactionSchema);

module.exports = ipoTransaction;

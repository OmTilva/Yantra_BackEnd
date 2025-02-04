const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment-timezone");

const transactionSchema = new mongoose.Schema(
  {
    transactionID: {
      type: String,
      default: uuidv4,
      unique: true,
      required: true,
    },
    bankerUsername: {
      type: String,
      required: [true, "Banker username is required"],
    },
    sellerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    buyerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    stockNumber: {
      type: String,
      ref: "Stock",
      required: [true, "Stock number is required"],
    },
    units: {
      type: Number,
      required: [true, "Number of units is required"],
      min: [1, "Units must be at least 1"],
    },
    price: {
      type: Number,
      required: [true, "Price per unit is required"],
      min: [0, "Price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    originalPrice: {
      type: Number,
      required: [true, "Original price is required"],
      min: [0, "Original price cannot be negative"],
    },
    oldPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
    },
    brokerHouseName: {
      type: String,
    },
    transactionTime: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to calculate totalPrice and set transactionTime
transactionSchema.pre("save", function (next) {
  if (this.isModified("units") || this.isModified("price")) {
    this.totalPrice = this.units * this.price;
  }
  const now = moment().tz("Asia/Kolkata");
  this.transactionTime = now.format("HH:mm:ss"); // Store only the time part in IST
  next();
});

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;

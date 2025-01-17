const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

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
      required: [true, "Seller ID is required"],
    },
    buyerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer ID is required"],
    },
    stockNumber: {
      type: String,
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
    transactionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to calculate totalPrice
transactionSchema.pre("save", function (next) {
  if (this.isModified("units") || this.isModified("price")) {
    this.totalPrice = this.units * this.price;
  }
  next();
});

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;

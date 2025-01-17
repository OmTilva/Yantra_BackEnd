const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  stockName: {
    type: String,
    required: [true, "Company name is required"],
    trim: true,
  },
  currentPrice: {
    type: Number,
    required: [true, "Current price is required"],
    min: 0,
  },
  previousClose: {
    type: Number,
    min: 0,
  },
  availableUnits: {
    type: Number,
    required: [true, "Available units is required"],
    min: 0,
  },
  totalUnits: {
    type: Number,
    required: [true, "Total units is required"],
    min: 0,
  },
  status: {
    type: String,
    enum: ["LISTED", "IPO", "UPCOMING"],
    default: "LISTED",
  },
  ipoDetails: {
    issuePrice: {
      type: Number,
      min: 0,
    },
    minLotSize: {
      type: Number,
      min: 1,
    },
    subscriptionStartDate: Date,
    subscriptionEndDate: Date,
    listingDate: Date,
  },
});

stockSchema.methods.startIPOSubscription = async function () {
  if (this.status !== "UPCOMING") {
    throw new Error("Only upcoming IPOs can be started");
  }
  this.status = "IPO";
  this.ipoDetails.subscriptionStartDate = new Date();
  await this.save();
  return this;
};

stockSchema.methods.endIPOSubscription = async function () {
  if (this.status !== "IPO") {
    throw new Error("Can only end active IPO subscriptions");
  }
  this.status = "LISTED";
  this.ipoDetails.subscriptionEndDate = new Date();
  this.currentPrice = this.ipoDetails.issuePrice;
  this.previousClose = this.ipoDetails.issuePrice;
  await this.save();
  return this;
};

stockSchema.methods.isIPOActive = function () {
  return (
    this.status === "IPO" &&
    this.ipoDetails.subscriptionStartDate <= new Date() &&
    (!this.ipoDetails.subscriptionEndDate ||
      this.ipoDetails.subscriptionEndDate > new Date())
  );
};

stockSchema.pre("save", function (next) {
  if (this.isNew) {
    this.availableUnits = this.totalUnits;
  }
  next();
});

const stockModel = mongoose.model("Stock", stockSchema);

module.exports = stockModel;

const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  stockName: {
    type: String,
    required: [true, "Company name is required"],
    trim: true,
  },
  currentPrice: {
    type: Number,
    min: 0,
    validate: {
      validator: function (value) {
        // If status is IPO, currentPrice is not required
        return this.status === "IPO" || value !== undefined;
      },
      message: "Current price is required unless the status is IPO",
    },
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
    listingDate: {
      type: Date,
    },
    subscriptionStartDate: {
      type: Date,
    },
    subscriptionEndDate: {
      type: Date,
    },
  },
});

stockSchema.methods.calculateIPOLaunchingPrice = async function () {
  const users = await mongoose.model("User").find({
    "ipoApplications.stock": this._id,
  });

  let demandVolume = 0;
  users.forEach((user) => {
    user.ipoApplications.forEach((application) => {
      if (application.stock.equals(this._id)) {
        demandVolume += application.lots * this.ipoDetails.minLotSize;
      }
    });
  });

  // console.log("demandVolume:", demandVolume);

  const demandRatio = demandVolume / this.totalUnits;
  // console.log("demandRatio:", demandRatio);
  const multiplier = 0.8; // Adjust this value to make the formula more bullish
  const ipoLaunchingPrice =
    this.ipoDetails.issuePrice * (0.9 + multiplier * demandRatio);
  // console.log("ipoLaunchingPrice:", ipoLaunchingPrice);

  this.currentPrice = ipoLaunchingPrice;
  await this.save();

  return ipoLaunchingPrice;
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

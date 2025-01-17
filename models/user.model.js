const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    unique: true,
  },

  password: {
    type: String,
    required: [true, "Password is required"],
    select: false,
  },

  balance: {
    type: Number,
    default: 1000000,
  },

  portfolio: [
    {
      stock: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stock",
      },
      quantity: Number,
      averageBuyPrice: Number,
    },
  ],

  ipoApplications: [
    {
      stock: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stock",
      },
      lots: Number,
      applicationPrice: Number,
      status: {
        type: String,
        enum: ["PENDING", "ALLOTTED", "REJECTED"],
        default: "PENDING",
      },
      appliedAt: {
        type: Date,
        default: Date.now,
      },
      allottedUnits: {
        type: Number,
        default: 0,
      },
    },
  ],

  transactions: [
    {
      type: {
        type: {
          type: String,
          enum: ["BUY", "SELL"],
        },
        stock: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Stock",
        },
        quantity: Number,
        price: Number,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    },
  ],

  role: {
    type: String,
    enum: ["user", "jobber", "banker", "admin"],
    default: "user",
  },
});

userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ _id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
  return token;
};

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.statics.hashPassword = async function (password) {
  return await bcrypt.hash(password, 8);
};

const userModel = mongoose.model("User", userSchema);

module.exports = userModel;

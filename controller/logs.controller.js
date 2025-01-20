const userModel = require("../models/user.model");
const stockModel = require("../models/stocks.model");
const transactionModel = require("../models/transaction.model");

module.exports.searchUserAccount = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await userModel
      .findOne({ username: username.trim() })
      .populate("portfolio.stock");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.searchTransaction = async (req, res) => {
  try {
    const { transactionID, bankerName, buyerName, sellerName } = req.query;
    const query = {};

    if (transactionID) {
      query.transactionID = transactionID.trim();
    }

    if (bankerName) {
      const banker = await userModel.findOne({ username: bankerName.trim() });
      if (banker) {
        query.bankerUsername = banker.username;
      } else {
        return res.status(404).json({ message: "Banker not found" });
      }
    }

    if (buyerName) {
      const buyer = await userModel.findOne({ username: buyerName.trim() });
      if (buyer) {
        query.buyerID = buyer._id;
      } else {
        return res.status(404).json({ message: "Buyer not found" });
      }
    }

    if (sellerName) {
      const seller = await userModel.findOne({ username: sellerName.trim() });
      if (seller) {
        query.sellerID = seller._id;
      } else {
        return res.status(404).json({ message: "Seller not found" });
      }
    }

    const transactions = await transactionModel.find(query);
    if (transactions.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const userModel = require("../models/user.model");
const stockModel = require("../models/stocks.model");
const transactionModel = require("../models/transaction.model");
const ipoTransactionModel = require("../models/ipoTransaction.model");

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

    const transactions = await transactionModel
      .find(query)
      .populate("buyerID", "username")
      .populate("sellerID", "username")
      .populate("stockNumber", "stockName");

    if (transactions.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    const transactions = await transactionModel
      .find(query)
      .populate("buyerID", "username")
      .populate("sellerID", "username")
      .populate("stockNumber", "stockName");

    if (transactions.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// module.exports.searchIpoTransactions = async (req, res) => {
//   try {
//     const { adminName, buyerName } = req.query;

//     if (!adminName || !buyerName) {
//       return res
//         .status(400)
//         .json({ message: "Admin name and buyer name are required" });
//     }

//     // Fetch admin details
//     const admin = await userModel.findOne({ username: adminName.trim() });
//     if (!admin || admin.role !== "admin") {
//       return res
//         .status(404)
//         .json({ message: "Admin not found or not authorized" });
//     }

//     // Fetch buyer details
//     const buyer = await userModel.findOne({ username: buyerName.trim() });
//     if (!buyer) {
//       return res.status(404).json({ message: "Buyer not found" });
//     }

//     // Fetch IPO transactions for the buyer
//     const ipoTransactions = await ipoTransactionModel
//       .find({ userID: buyer._id })
//       .populate("userID", "username")
//       .populate("stockID", "stockName")
//       .populate("adminID", "username");

//     if (ipoTransactions.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No IPO transactions found for the buyer" });
//     }

//     res.status(200).json(ipoTransactions);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

module.exports.searchIpoTransactions = async (req, res) => {
  try {
    const { adminName, buyerName } = req.query;

    if (!adminName && !buyerName) {
      return res
        .status(400)
        .json({ message: "Either admin name or buyer name is required" });
    }

    let query = {};

    if (adminName) {
      // Fetch admin details
      const admin = await userModel.findOne({ username: adminName.trim() });
      if (!admin || admin.role !== "admin") {
        return res
          .status(404)
          .json({ message: "Admin not found or not authorized" });
      }
      query.adminID = admin._id;
    }

    if (buyerName) {
      // Fetch buyer details
      const buyer = await userModel.findOne({ username: buyerName.trim() });
      if (!buyer) {
        return res.status(404).json({ message: "Buyer not found" });
      }
      query.userID = buyer._id;
    }

    // Fetch IPO transactions based on the query
    const ipoTransactions = await ipoTransactionModel
      .find(query)
      .populate("userID", "username")
      .populate("stockID", "stockName")
      .populate("adminID", "username");

    if (ipoTransactions.length === 0) {
      return res.status(404).json({ message: "No IPO transactions found" });
    }

    res.status(200).json(ipoTransactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

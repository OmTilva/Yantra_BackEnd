const mongoose = require("mongoose");
const stockModel = require("../models/stocks.model");
const Transaction = require("../models/transaction.model");
const brokerHouseModel = require("../models/brokerHouse.model");
const userModel = require("../models/user.model");
const Manipulator = require("../models/manipulator.model");
const ipoTransactionModel = require("../models/ipoTransaction.model");
const { validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");

module.exports.addStock = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    // Check if the stock already exists
    const existingStock = await stockModel.findOne({
      stockName: req.body.stockName,
    });
    if (existingStock) {
      return res.status(400).json({ message: "Stock already exists" });
    }

    const stock = await stockModel.create(req.body);
    res.status(201).json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getAllStocks = async (req, res) => {
  try {
    const stocks = await stockModel.find({ status: "LISTED" });
    res.status(200).json(stocks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getIPOStocks = async (req, res) => {
  try {
    const stocks = await stockModel.find({
      status: { $in: ["IPO", "UPCOMING"] },
    });
    res.status(200).json(stocks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getUpcomingIPOs = async (req, res) => {
  try {
    const upcomingIPOs = await stockModel.find({ status: "UPCOMING" });
    res.status(200).json(upcomingIPOs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getApplicantsForIPO = async (req, res) => {
  try {
    const { stockName } = req.params;
    const stock = await stockModel.findOne({ stockName: stockName.trim() });

    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    const applications = await userModel.aggregate([
      { $unwind: "$ipoApplications" },
      { $match: { "ipoApplications.stock": stock._id } },
      {
        $lookup: {
          from: "stocks",
          localField: "ipoApplications.stock",
          foreignField: "_id",
          as: "stockDetails",
        },
      },
      { $unwind: "$stockDetails" },
      {
        $project: {
          _id: "$ipoApplications._id",
          username: "$username",
          stockName: "$stockDetails.stockName",
          stockId: "$stockDetails._id",
          lots: "$ipoApplications.lots",
          status: "$ipoApplications.status",
          applicationPrice: "$ipoApplications.applicationPrice",
          totalApplicationPrice: "$ipoApplications.totalApplicationPrice",
        },
      },
    ]);
    // console.log(applications);
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.startIPO = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const { ipoName } = req.body;
    const stock = await stockModel.findOne({ stockName: ipoName.trim() });

    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    if (stock.status !== "UPCOMING") {
      return res
        .status(400)
        .json({ message: "Only upcoming IPOs can be started" });
    }

    stock.status = "IPO";
    stock.ipoDetails.subscriptionStartDate = new Date();
    await stock.save();

    res.status(200).json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.allotMultipleStocks = async (req, res) => {
  try {
    const adminUser = await userModel.findById(req.user._id);

    // Check if the user is an admin or banker
    if (
      !adminUser ||
      (adminUser.role !== "admin" && adminUser.role !== "banker")
    ) {
      return res.status(403).json({
        message: "Unauthorized: Only bankers and admins can allot stocks",
      });
    }

    const { allotments } = req.body;
    if (!Array.isArray(allotments) || allotments.length === 0) {
      return res.status(400).json({ message: "Invalid allotment data" });
    }

    const results = [];
    for (const allotment of allotments) {
      const { userId, stockId, quantity, price } = allotment;
      const user = await userModel.findById(userId);
      const stock = await stockModel.findById(stockId);

      if (!user || !stock) {
        results.push({
          userId,
          stockId,
          status: "failed",
          message: "Invalid user or stock",
        });
        continue;
      }

      if (price == null) {
        results.push({
          userId,
          stockId,
          status: "failed",
          message: "Stock price cannot be null",
        });
        continue;
      }

      const totalCost = quantity * price;

      if (totalCost > user.balance) {
        return res.status(400).json({
          message: `Insufficient balance for user: ${user.username}`,
        });
      }

      if (quantity > stock.availableUnits) {
        return res.status(400).json({
          message: `Insufficient stock available for stock: ${stock.stockName}`,
        });
      }

      // Deduct the total cost from the user's balance
      user.balance -= totalCost;

      // Deduct the quantity from the stock's available units
      stock.availableUnits -= quantity;

      // Check if the stock already exists in the user's portfolio
      const existingPortfolioEntry = user.portfolio.find(
        (p) => p.stock.toString() === stock._id.toString()
      );

      if (existingPortfolioEntry) {
        // Update the quantity without recalculating the average buy price
        existingPortfolioEntry.quantity =
          Number(existingPortfolioEntry.quantity) + Number(quantity);
      } else {
        // Add a new entry to the portfolio
        user.portfolio.push({
          stock: stock._id,
          quantity: Number(quantity),
          averageBuyPrice: price,
        });
      }

      await user.save();
      await stock.save();

      results.push({
        userId,
        stockId,
        status: "success",
        message: "Stock allotted successfully",
      });
    }

    res.status(200).json({ message: "Allotment process completed", results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getStockById = async (req, res) => {
  try {
    const stock = await stockModel.findById(req.params.id);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }
    res.status(200).json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.sellStock = async (req, res) => {
  try {
    const {
      sellerName,
      buyerName,
      stockName,
      quantity,
      tradePrice,
      brokerHouseName,
    } = req.body;

    // Validate input
    if (
      !sellerName ||
      !buyerName ||
      !stockName ||
      !quantity ||
      !tradePrice ||
      !brokerHouseName
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 1. Fetch stock details by stockName
    const stock = await stockModel.findOne({ stockName: stockName.trim() });
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    const stockId = stock._id;

    // 2. Fetch seller and buyer account details by their names
    const seller = await userModel.findOne({ username: sellerName.trim() });
    const buyer = await userModel.findOne({ username: buyerName.trim() });
    if (!seller || !buyer) {
      return res.status(404).json({ message: "Seller or buyer not found" });
    }

    // Check if both seller and buyer have the role "user"
    if (seller.role !== "user" || buyer.role !== "user") {
      return res
        .status(403)
        .json({ message: "Only users with role 'user' can trade" });
    }

    // 3. Fetch broker house details by brokerHouseName
    const brokerHouse = await brokerHouseModel.findOne({
      name: brokerHouseName.trim(),
    });
    if (!brokerHouse) {
      return res.status(404).json({ message: "BrokerHouse not found" });
    }
    const brokerageRate = brokerHouse.brokerage;

    // 3. Verify if seller has enough stock
    const sellerStock = seller.portfolio.find(
      (p) => p.stock.toString() === stockId.toString()
    );
    if (!sellerStock || Number(sellerStock.quantity) < Number(quantity)) {
      return res.status(400).json({ message: "Insufficient stock quantity" });
    }

    // 4. Verify if buyer has enough balance
    const totalCost = Number(quantity) * Number(tradePrice);
    const brokerageFee = (totalCost * brokerageRate) / 100;

    if (Number(buyer.balance) < totalCost + brokerageFee) {
      return res
        .status(400)
        .json({ message: "Buyer has Insufficient balance" });
    }

    // 5. Perform the transaction
    // a. Update Seller's stock and balance
    sellerStock.quantity = Number(sellerStock.quantity) - Number(quantity);
    if (Number(sellerStock.quantity) === 0) {
      seller.portfolio = seller.portfolio.filter(
        (p) => p.stock.toString() !== stockId.toString()
      );
    }
    seller.balance = Number(seller.balance) + totalCost;

    // b. Update Buyer's stock and balance
    const buyerStock = buyer.portfolio.find(
      (p) => p.stock.toString() === stockId.toString()
    );
    if (buyerStock) {
      const newTotalQuantity = Number(buyerStock.quantity) + Number(quantity);
      const newTotalCost =
        Number(buyerStock.quantity) * Number(buyerStock.averageBuyPrice) +
        totalCost;
      buyerStock.quantity = newTotalQuantity;
      buyerStock.averageBuyPrice = (newTotalCost / newTotalQuantity).toFixed(2);
    } else {
      buyer.portfolio.push({
        stock: stockId,
        quantity: Number(quantity),
        averageBuyPrice: Number(tradePrice),
      });
    }
    buyer.balance = Number(buyer.balance) - totalCost;

    // c. Save the updated seller and buyer accounts
    await seller.save();
    await buyer.save();

    // Deduct the brokerage fee from both the buyer and seller
    if (seller.balance < brokerageFee || buyer.balance < brokerageFee) {
      return res
        .status(400)
        .json({ message: "Insufficient balance for brokerage fee" });
    }
    seller.balance -= brokerageFee;
    buyer.balance -= brokerageFee;

    await seller.save();
    await buyer.save();

    // Fetch the manipulator value
    const manipulator = await Manipulator.findOne();
    const manipulatorValue = manipulator ? manipulator.value : 20.6;

    // 6. Calculate the new stock price
    const priceDifference = Number(tradePrice) - Number(stock.currentPrice);
    const priceChangeFactor = parseFloat(
      (
        (Number(quantity) / Number(stock.availableUnits)) *
        (priceDifference + 2.4) *
        manipulatorValue
      ).toFixed(2)
    );

    // Update previousClose before updating currentPrice
    const oldPrice = stock.previousClose;
    stock.previousClose = Number(stock.currentPrice);
    stock.currentPrice = Number(stock.currentPrice) + priceChangeFactor;

    // 7. Update the stock price in the collection
    await stock.save();

    // 8. Fetch the admin's username from the session
    const adminUsername = req.user.username;

    // 9. Generate a transaction ID
    const transactionId = uuidv4();
    // 10. Log the transaction
    const transaction = new Transaction({
      transactionID: transactionId,
      bankerUsername: adminUsername,
      sellerID: seller._id,
      buyerID: buyer._id,
      stockNumber: stockId,
      units: Number(quantity),
      price: Number(tradePrice),
      totalPrice: totalCost,
      originalPrice: Number(stock.previousClose),
      oldPrice: oldPrice,
      brokerHouseName: brokerHouseName, // Include brokerHouseName
    });
    await transaction.save();

    res.status(200).json({
      message: "Stock sold successfully",
      transaction: {
        transactionID: transactionId,
        sellerName: seller.username,
        buyerName: buyer.username,
        stockName: stock.stockName,
        quantity: Number(quantity),
        tradePrice: Number(tradePrice),
        totalPrice: totalCost,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.revertTransaction = async (req, res) => {
  try {
    const { transactionID } = req.body;

    const transaction = await Transaction.findOne({ transactionID });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    // console.log(transaction);
    const seller = await userModel.findById(transaction.sellerID);
    const buyer = await userModel.findById(transaction.buyerID);
    const stock = await stockModel.findById(transaction.stockNumber);

    if (!seller || !buyer || !stock) {
      return res.status(404).json({ message: "Invalid transaction details" });
    }

    // Revert the transaction
    const totalCost = transaction.units * transaction.price;
    const brokerageRate = (
      await brokerHouseModel.findOne({ name: transaction.brokerHouseName })
    ).brokerage;
    const brokerageFee = (totalCost * brokerageRate) / 100;

    // Update seller's portfolio and balance
    const sellerStock = seller.portfolio.find(
      (p) => p.stock.toString() === stock._id.toString()
    );
    if (sellerStock) {
      sellerStock.quantity += transaction.units;
    } else {
      seller.portfolio.push({
        stock: stock._id,
        quantity: transaction.units,
        averageBuyPrice: transaction.price,
      });
    }
    seller.balance -= totalCost;
    seller.balance += brokerageFee; // Add brokerage fee back to seller's balance

    // Update buyer's portfolio and balance
    const buyerStock = buyer.portfolio.find(
      (p) => p.stock.toString() === stock._id.toString()
    );
    if (buyerStock) {
      buyerStock.quantity -= transaction.units;
      if (buyerStock.quantity === 0) {
        buyer.portfolio = buyer.portfolio.filter(
          (p) => p.stock.toString() !== stock._id.toString()
        );
      }
    }
    buyer.balance += totalCost;
    buyer.balance += brokerageFee; // Add brokerage fee back to buyer's balance

    await seller.save();
    await buyer.save();

    // Check if the stock's current price has changed
    if (stock.previousClose !== transaction.originalPrice) {
      // Calculate the price change factor for the reverted transaction
      const priceDifference =
        Number(transaction.price) - Number(stock.currentPrice);
      const priceChangeFactor = parseFloat(
        (
          (Number(transaction.units) / Number(stock.totalUnits)) *
          (priceDifference + 2.4) *
          12.6
        ).toFixed(2)
      );

      // Revert the stock price change
      stock.currentPrice = Number(stock.currentPrice) - priceChangeFactor;
    } else {
      // Fetch the original price from the transaction log
      stock.currentPrice = transaction.originalPrice;
      stock.previousClose = transaction.oldPrice;
    }

    await stock.save();

    // Delete the transaction
    await Transaction.deleteOne({ transactionID });

    res.status(200).json({ message: "Transaction reverted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.tradeWithMarket = async (req, res) => {
  try {
    const { username, stockName, quantity, action } = req.body;

    // Fetch user details by username
    const user = await userModel.findOne({ username: username.trim() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user has the role "user"
    if (user.role !== "user") {
      return res.status(403).json({
        message: "Only users with role 'user' can trade with the market",
      });
    }

    // Fetch stock details by stockName
    const stock = await stockModel.findOne({ stockName: stockName.trim() });
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    const totalCost = Number(quantity) * Number(stock.currentPrice);

    if (action === "buy") {
      // User buying from the market
      if (Number(user.balance) < totalCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      if (Number(stock.availableUnits) < Number(quantity)) {
        return res
          .status(400)
          .json({ message: "Not enough stock available in the market" });
      }

      // Update user's portfolio and balance
      const userStock = user.portfolio.find(
        (p) => p.stock.toString() === stock._id.toString()
      );
      if (userStock) {
        const newTotalQuantity = Number(userStock.quantity) + Number(quantity);
        const newTotalCost =
          Number(userStock.quantity) * Number(userStock.averageBuyPrice) +
          totalCost;
        userStock.quantity = newTotalQuantity;
        userStock.averageBuyPrice = (newTotalCost / newTotalQuantity).toFixed(
          2
        );
      } else {
        user.portfolio.push({
          stock: stock._id,
          quantity: Number(quantity),
          averageBuyPrice: stock.currentPrice,
        });
      }
      user.balance = Number(user.balance) - totalCost;

      // Save the updated user account
      await user.save();

      // Fetch the manipulator value
      const manipulator = await Manipulator.findOne();
      const manipulatorValue = manipulator ? manipulator.value : 20.6;

      // Calculate the new stock price
      const priceDifference =
        Number(stock.currentPrice) - Number(stock.previousClose);
      const priceChangeFactor = parseFloat(
        (
          (Number(quantity) / Number(stock.availableUnits)) *
          (priceDifference + 2.4) *
          manipulatorValue
        ).toFixed(2)
      );

      // Update previousClose before updating currentPrice
      stock.previousClose = Number(stock.currentPrice);
      stock.currentPrice = Number(stock.currentPrice) + priceChangeFactor;

      // Update available units after calculating the new stock price
      stock.availableUnits = Number(stock.availableUnits) - Number(quantity);

      // Save the updated stock
      await stock.save();

      res.status(200).json({ message: "Stock bought successfully" });
    } else if (action === "sell") {
      // User selling to the market
      const userStock = user.portfolio.find(
        (p) => p.stock.toString() === stock._id.toString()
      );
      if (!userStock || Number(userStock.quantity) < Number(quantity)) {
        return res.status(400).json({ message: "Insufficient stock quantity" });
      }

      // Update user's portfolio and balance
      userStock.quantity = Number(userStock.quantity) - Number(quantity);
      if (Number(userStock.quantity) === 0) {
        user.portfolio = user.portfolio.filter(
          (p) => p.stock.toString() !== stock._id.toString()
        );
      }
      user.balance = Number(user.balance) + totalCost;

      // Save the updated user account
      await user.save();

      // Fetch the manipulator value
      const manipulator = await Manipulator.findOne();
      const manipulatorValue = manipulator ? manipulator.value : 20.6;

      // Calculate the new stock price
      const priceDifference =
        Number(stock.currentPrice) - Number(stock.previousClose);
      const priceChangeFactor = parseFloat(
        (
          (Number(quantity) / Number(stock.availableUnits)) *
          (priceDifference + 2.4) *
          manipulatorValue
        ).toFixed(2)
      );

      // Update previousClose before updating currentPrice
      stock.previousClose = Number(stock.currentPrice);
      stock.currentPrice = Number(stock.currentPrice) + priceChangeFactor;

      // Update available units after calculating the new stock price
      stock.availableUnits = Number(stock.availableUnits) + Number(quantity);

      // Save the updated stock
      await stock.save();

      res.status(200).json({ message: "Stock sold successfully" });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.updateStockValue = async (req, res) => {
  try {
    const { stockName, value, type, action } = req.body;

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const stock = await stockModel.findOne({ stockName: stockName.trim() });
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    let newValue;
    if (type === "value") {
      newValue =
        action === "increase"
          ? stock.currentPrice + value
          : stock.currentPrice - value;
    } else if (type === "percentage") {
      const percentageChange = (stock.currentPrice * value) / 100;
      newValue =
        action === "increase"
          ? stock.currentPrice + percentageChange
          : stock.currentPrice - percentageChange;
    } else {
      return res
        .status(400)
        .json({ message: "Invalid type. Must be 'value' or 'percentage'." });
    }

    stock.previousClose = stock.currentPrice;
    stock.currentPrice = newValue;

    await stock.save();

    res
      .status(200)
      .json({ message: "Stock value updated successfully", stock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.updateMarketValue = async (req, res) => {
  try {
    const { percentage, action } = req.body;

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const stocks = await stockModel.find();

    for (const stock of stocks) {
      const percentageChange = (stock.currentPrice * percentage) / 100;
      const newValue =
        action === "increase"
          ? stock.currentPrice + percentageChange
          : stock.currentPrice - percentageChange;

      stock.previousClose = stock.currentPrice;
      stock.currentPrice = newValue;

      await stock.save();
    }

    res.status(200).json({ message: "Market values updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.applyForIPO = async (req, res) => {
  try {
    const { username, stockId, lots } = req.body;

    // Check if the user making the request is a banker or admin
    if (!["banker", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Unauthorized: Only bankers and admins can apply for IPO",
      });
    }

    const user = await userModel.findOne({ username: username.trim() });
    const stock = await stockModel.findById(stockId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!stock || stock.status !== "IPO") {
      return res.status(400).json({ message: "Invalid IPO application" });
    }

    const totalApplicationPrice =
      lots * stock.ipoDetails.minLotSize * stock.ipoDetails.issuePrice;

    if (user.balance < totalApplicationPrice) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.balance -= totalApplicationPrice;
    user.ipoApplications.push({
      stock: stockId,
      lots,
      applicationPrice: stock.ipoDetails.issuePrice,
      totalApplicationPrice,
    });

    await user.save();
    res.status(200).json({ message: "IPO application submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.endIPOApplications = async (req, res) => {
  try {
    const { stockName } = req.body;
    const adminUser = await userModel.findById(req.user._id);

    // Check if the user is an admin
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const stock = await stockModel.findOne({ stockName: stockName.trim() });

    if (!stock || stock.status !== "IPO") {
      return res
        .status(400)
        .json({ message: "Invalid stock or not in IPO status" });
    }

    // Check if the IPO has started
    if (!stock.ipoDetails.subscriptionStartDate) {
      return res.status(400).json({ message: "IPO has not started yet" });
    }

    // End IPO applications
    stock.ipoDetails.subscriptionEndDate = new Date();
    await stock.save();

    res.status(200).json({ message: "IPO applications ended", stock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.allotIPO = async (req, res) => {
  try {
    const { stockName, username, lots } = req.body;
    const adminUser = await userModel.findById(req.user._id);

    // Check if the user is an admin
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const user = await userModel.findOne({ username: username.trim() });
    const stock = await stockModel.findOne({ stockName: stockName.trim() });

    if (!user || !stock) {
      return res.status(400).json({ message: "Invalid user or stock" });
    }

    const application = user.ipoApplications.find(
      (app) => app.stock.equals(stock._id) && app.status === "PENDING"
    );

    if (!application) {
      return res
        .status(400)
        .json({ message: "No pending IPO application found" });
    }

    const allottedUnits = lots * stock.ipoDetails.minLotSize;

    // Check if the stock already exists in the user's portfolio
    const existingPortfolioEntry = user.portfolio.find(
      (p) => p.stock.toString() === stock._id.toString()
    );

    if (existingPortfolioEntry) {
      // Update the quantity and average buy price
      const newTotalQuantity = existingPortfolioEntry.quantity + allottedUnits;
      const newTotalCost =
        existingPortfolioEntry.quantity *
          existingPortfolioEntry.averageBuyPrice +
        allottedUnits * stock.ipoDetails.issuePrice;
      existingPortfolioEntry.quantity = newTotalQuantity;
      existingPortfolioEntry.averageBuyPrice = (
        newTotalCost / newTotalQuantity
      ).toFixed(2);
    } else {
      // Add a new entry to the portfolio
      user.portfolio.push({
        stock: stock._id,
        quantity: allottedUnits,
        averageBuyPrice: stock.ipoDetails.issuePrice,
      });
    }

    application.status = "ALLOTTED";
    application.allottedUnits = allottedUnits;
    application.totalApplicationPrice = 0;

    await user.save();

    // Create IPO transaction
    const transactionId = uuidv4();
    const ipoTransaction = new ipoTransactionModel({
      transactionID: transactionId,
      userID: user._id,
      stockID: stock._id,
      adminID: adminUser._id,
      lots: lots,
      allottedUnits: allottedUnits,
      pricePerUnit: stock.ipoDetails.issuePrice,
      totalPrice: allottedUnits * stock.ipoDetails.issuePrice,
      status: "ALLOTTED",
    });
    await ipoTransaction.save();

    res.status(200).json({ message: "IPO allotment processed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.closeIPOAllotment = async (req, res) => {
  try {
    const { stockName } = req.body;
    const adminUser = await userModel.findById(req.user._id);

    // Check if the user is an admin
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const stock = await stockModel.findOne({ stockName: stockName.trim() });

    if (!stock || stock.status !== "IPO") {
      return res
        .status(400)
        .json({ message: "Invalid stock or not in IPO status" });
    }

    // Check if the IPO has started
    if (!stock.ipoDetails.subscriptionStartDate) {
      return res.status(400).json({ message: "IPO has not started yet" });
    }

    // Check if the IPO applications have ended
    if (!stock.ipoDetails.subscriptionEndDate) {
      return res
        .status(400)
        .json({ message: "IPO applications have not ended yet" });
    }

    // Calculate IPO launching price
    const ipoLaunchingPrice = await stock.calculateIPOLaunchingPrice();
    // console.log(ipoLaunchingPrice);

    // Update stock status to LISTED
    stock.status = "LISTED";
    stock.currentPrice = ipoLaunchingPrice;
    stock.previousClose = stock.ipoDetails.issuePrice;

    // Calculate available volume
    const users = await userModel.find({
      "ipoApplications.stock": stock._id,
    });

    let totalAllottedUnits = 0;
    for (const user of users) {
      for (const application of user.ipoApplications) {
        if (application.stock.equals(stock._id)) {
          if (application.status === "ALLOTTED") {
            totalAllottedUnits += application.allottedUnits;
            await user.save();
          } else if (application.status === "PENDING") {
            user.balance += application.totalApplicationPrice;
            application.status = "REJECTED";
            application.totalApplicationPrice = 0;
            await user.save();
          }
        }
      }
    }

    stock.availableUnits = stock.totalUnits - totalAllottedUnits;

    await stock.save();

    res
      .status(200)
      .json({ message: "IPO allotment closed and stock listed", stock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const mongoose = require("mongoose");
const stockModel = require("../models/stocks.model");
const Transaction = require("../models/transaction.model");
const userModel = require("../models/user.model");
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
      status: { $in: ["IPO"] },
    });
    res.status(200).json(stocks);
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

    const stock = await stockModel.findById(req.params.id);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    await stock.startIPOSubscription();
    res.status(200).json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.endIPO = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const stock = await stockModel.findById(req.params.id);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    await stock.endIPOSubscription();
    res.status(200).json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.allotMultipleStocks = async (req, res) => {
  try {
    if (!["banker", "admin"].includes(req.user.role)) {
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
          message: "User or stock not found",
        });
        continue;
      }

      const totalCost = Number(quantity) * Number(price);
      if (Number(user.balance) < totalCost) {
        results.push({
          userId,
          stockId,
          status: "failed",
          message: "Insufficient balance",
        });
        continue;
      }
      if (Number(stock.availableUnits) < Number(quantity)) {
        results.push({
          userId,
          stockId,
          status: "failed",
          message: "Insufficient stock units",
        });
        continue;
      }

      try {
        const existingPosition = user.portfolio.find(
          (p) => p.stock.toString() === stockId
        );
        if (existingPosition) {
          existingPosition.quantity =
            Number(existingPosition.quantity) + Number(quantity);
          existingPosition.averageBuyPrice = (
            (Number(existingPosition.quantity) *
              Number(existingPosition.averageBuyPrice) +
              Number(quantity) * Number(price)) /
            (Number(existingPosition.quantity) + Number(quantity))
          ).toFixed(2);
        } else {
          user.portfolio.push({
            stock: stockId,
            quantity: Number(quantity),
            averageBuyPrice: Number(price),
          });
        }
        user.balance = Number(user.balance) - totalCost;
        user.transactions.push({
          type: "BUY",
          stock: stockId,
          quantity: Number(quantity),
          price: Number(price),
        });
        stock.availableUnits = Number(stock.availableUnits) - Number(quantity);

        await user.save();
        await stock.save();

        results.push({
          userId,
          stockId,
          status: "success",
          message: "Stock allotted successfully",
        });
      } catch (error) {
        results.push({
          userId,
          stockId,
          status: "failed",
          message: error.message,
        });
      }
    }

    res.status(200).json({ message: "Allotment process completed", results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.sellStock = async (req, res) => {
  try {
    const { sellerName, buyerName, stockName, quantity, tradePrice } = req.body;

    // Validate input
    if (!sellerName || !buyerName || !stockName || !quantity || !tradePrice) {
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

    // 3. Verify if seller has enough stock
    const sellerStock = seller.portfolio.find(
      (p) => p.stock.toString() === stockId.toString()
    );
    if (!sellerStock || Number(sellerStock.quantity) < Number(quantity)) {
      return res.status(400).json({ message: "Insufficient stock quantity" });
    }

    // 4. Verify if buyer has enough balance
    const totalCost = Number(quantity) * Number(tradePrice);
    if (Number(buyer.balance) < totalCost) {
      return res.status(400).json({ message: "Insufficient balance" });
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

    // 6. Calculate the new stock price
    const priceDifference = Number(tradePrice) - Number(stock.currentPrice);
    const priceChangeFactor = parseFloat(
      (
        (Number(quantity) / Number(stock.totalUnits)) *
        (priceDifference + 2.4) *
        12.6
      ).toFixed(2)
    );

    // Update previousClose before updating currentPrice
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
      originalPrice: Number(stock.currentPrice),
    });
    await transaction.save();

    res.status(200).json({ message: "Stock sold successfully", transaction });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.tradeWithMarket = async (req, res) => {
  try {
    const { username, stockName, quantity, action } = req.body;

    // Validate input
    if (!username || !stockName || !quantity || !action) {
      return res.status(400).json({ message: "All fields are required" });
    }

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
      stock.availableUnits = Number(stock.availableUnits) - Number(quantity);

      await user.save();
      await stock.save();

      // Calculate the new stock price
      const priceDifference =
        Number(stock.currentPrice) - Number(stock.previousClose);
      const priceChangeFactor = parseFloat(
        (
          (Number(quantity) / Number(stock.totalUnits)) *
          (priceDifference + 2.4) *
          12.6
        ).toFixed(2)
      );

      // Update previousClose before updating currentPrice
      stock.previousClose = Number(stock.currentPrice);
      stock.currentPrice = Number(stock.currentPrice) + priceChangeFactor;

      // Update the stock price in the collection
      await stock.save();

      // Fetch the admin's username from the session
      const adminUsername = req.user.username;

      // Generate a transaction ID
      const transactionId = uuidv4();

      // Log the transaction
      const transaction = new Transaction({
        transactionID: transactionId,
        bankerUsername: adminUsername,
        sellerID: null, // Market is the seller
        buyerID: user._id,
        stockNumber: stock._id,
        units: Number(quantity),
        price: Number(stock.currentPrice),
        totalPrice: totalCost,
        originalPrice: Number(stock.currentPrice),
      });
      await transaction.save();

      return res
        .status(200)
        .json({ message: "Stock purchased from the market", transaction });
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
      stock.availableUnits = Number(stock.availableUnits) + Number(quantity);

      await user.save();
      await stock.save();

      // Calculate the new stock price
      const priceDifference =
        Number(stock.currentPrice) - Number(stock.previousClose);
      const priceChangeFactor = parseFloat(
        (
          (Number(quantity) / Number(stock.totalUnits)) *
          (priceDifference + 2.4) *
          12.6
        ).toFixed(2)
      );

      // Update previousClose before updating currentPrice
      stock.previousClose = Number(stock.currentPrice);
      stock.currentPrice = Number(stock.currentPrice) + priceChangeFactor;

      // Update the stock price in the collection
      await stock.save();

      // Fetch the admin's username from the session
      const adminUsername = req.user.username;

      // Generate a transaction ID
      const transactionId = uuidv4();

      // Log the transaction
      const transaction = new Transaction({
        transactionID: transactionId,
        bankerUsername: adminUsername,
        sellerID: user._id,
        buyerID: null, // Market is the buyer
        stockNumber: stock._id,
        units: Number(quantity),
        price: Number(stock.currentPrice),
        totalPrice: totalCost,
        originalPrice: Number(stock.currentPrice),
      });
      await transaction.save();

      return res
        .status(200)
        .json({ message: "Stock sold to the market", transaction });
    } else {
      return res.status(400).json({ message: "Invalid action" });
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

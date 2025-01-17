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

module.exports.updateStock = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const stock = await stockModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }

    res.status(200).json(stock);
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

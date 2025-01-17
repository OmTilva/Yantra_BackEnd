const userModel = require("../models/user.model");
const stockModel = require("../models/stocks.model");

module.exports.getLeaderboard = async (req, res) => {
  try {
    // 1. Fetch all accounts from the Account collection
    const users = await userModel
      .find({ role: "user" })
      .populate("portfolio.stock");

    // 2. Fetch all stock data from the Stock collection
    const stocks = await stockModel.find();

    // Create a map of stock prices for quick lookup
    const stockPriceMap = new Map();
    stocks.forEach((stock) => {
      stockPriceMap.set(stock._id.toString(), stock.currentPrice);
    });

    // 3. Calculate the total value for each account
    const userPerformances = users.map((user) => {
      // 4. Calculate the value of stocks held by the user
      const totalStockValue = user.portfolio.reduce((acc, stockItem) => {
        const stockPrice = stockPriceMap.get(stockItem.stock._id.toString());
        return acc + Number(stockItem.quantity) * Number(stockPrice);
      }, 0);

      // Total value is the sum of balance and total stock value
      const totalValue = Number(user.balance) + totalStockValue;

      return {
        username: user.username,
        totalValue: totalValue || 0, // Ensure totalValue is a number
      };
    });

    // 6. Sort leaderboard by total value in descending order
    userPerformances.sort((a, b) => b.totalValue - a.totalValue);

    // 5. Return the account information along with total value
    res.status(200).json(userPerformances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

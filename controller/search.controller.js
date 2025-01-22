const userModel = require("../models/user.model");
const stockModel = require("../models/stocks.model");

module.exports.getLeaderboard = async (req, res) => {
  try {
    const users = await userModel
      .find({ role: "user" })
      .populate("portfolio.stock")
      .lean();
    const stocks = await stockModel.find().lean();

    const stockPriceMap = new Map(
      stocks.map((stock) => [stock._id.toString(), stock.currentPrice])
    );

    const userPerformances = users.map((user) => {
      const totalStockValue =
        user.portfolio?.reduce((acc, stockItem) => {
          const stockPrice = stockPriceMap.get(
            stockItem.stock?._id?.toString()
          );
          return stockPrice && stockItem.quantity
            ? acc + Number(stockItem.quantity) * Number(stockPrice)
            : acc;
        }, 0) || 0;

      const totalValue = (Number(user.balance) || 0) + totalStockValue;

      return {
        username: user.username,
        totalValue,
      };
    });

    userPerformances.sort(
      (a, b) =>
        b.totalValue - a.totalValue || a.username.localeCompare(b.username)
    );

    res.status(200).json(userPerformances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

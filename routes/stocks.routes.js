const express = require("express");
const router = express.Router();
const stocksController = require("../controller/stocks.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/add", authMiddleware.authUser, stocksController.addStock);

router.get(
  "/allStocks",
  authMiddleware.authUser,
  stocksController.getAllStocks
);

router.get("/allIpo", authMiddleware.authUser, stocksController.getIPOStocks);

router.post(
  "/allot-multiple-stocks",
  authMiddleware.authUser,
  stocksController.allotMultipleStocks
);

router.post("/sell-stock", authMiddleware.authUser, stocksController.sellStock);

router.post(
  "/update-stock",
  authMiddleware.authUser,
  stocksController.updateStockValue
);

router.post(
  "/update-market",
  authMiddleware.authUser,
  stocksController.updateMarketValue
);

module.exports = router;

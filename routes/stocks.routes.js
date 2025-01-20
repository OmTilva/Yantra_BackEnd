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

router.get(
  "/allUpcomingIpo",
  authMiddleware.authUser,
  stocksController.getUpcomingIPOs
);

router.get("/:id", authMiddleware.authUser, stocksController.getStockById); // Add this line

router.post(
  "/allot-multiple-stocks",
  authMiddleware.authUser,
  stocksController.allotMultipleStocks
);

router.post("/sell-stock", authMiddleware.authUser, stocksController.sellStock);

router.post(
  "/trade-with-market",
  authMiddleware.authUser,
  stocksController.tradeWithMarket
);

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

router.post(
  "/apply-ipo",
  authMiddleware.authUser,
  stocksController.applyForIPO
);

router.post("/allot-ipo", authMiddleware.authUser, stocksController.allotIPO);

router.post(
  "/close-ipo-allotment",
  authMiddleware.authUser,
  stocksController.closeIPOAllotment
);
router.post(
  "/end-ipo-applications",
  authMiddleware.authUser,
  stocksController.endIPOApplications
);

router.post("/start-ipo", authMiddleware.authUser, stocksController.startIPO);

router.get(
  "/applicantsForIpo/:stockName",
  authMiddleware.authUser,
  stocksController.getApplicantsForIPO
);

module.exports = router;

const express = require("express");
const router = express.Router();
const brokerhouseController = require("../controller/brokerHouse.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get(
  "/get-all-brokerhouses",
  authMiddleware.authUser,
  brokerhouseController.getAllBrokerHouses
);
router.post(
  "/create-brokerhouse",
  authMiddleware.authUser,
  brokerhouseController.createBrokerHouse
);
router.put(
  "/update-brokerage",
  authMiddleware.authUser,
  brokerhouseController.updateBrokerHouseBrokerage
);

router.get(
  "/name/:name",
  authMiddleware.authUser,
  brokerhouseController.getBrokerHouseByName
);

module.exports = router;

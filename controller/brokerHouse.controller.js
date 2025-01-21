const brokerHouseModel = require("../models/brokerHouse.model");

module.exports.getAllBrokerHouses = async (req, res) => {
  try {
    const brokerHouses = await brokerHouseModel.find();
    res.status(200).json(brokerHouses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.createBrokerHouse = async (req, res) => {
  try {
    const { name, brokerage } = req.body;
    const brokerHouse = new brokerHouseModel({ name, brokerage });
    await brokerHouse.save();
    res.status(201).json(brokerHouse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.updateBrokerHouseBrokerage = async (req, res) => {
  try {
    const { brokerHouseName, newBrokerage } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const brokerHouse = await brokerHouseModel.findOne({
      name: brokerHouseName,
    });

    if (!brokerHouse) {
      return res.status(404).json({ message: "BrokerHouse not found" });
    }

    brokerHouse.brokerage = newBrokerage;
    await brokerHouse.save();

    res.status(200).json({ message: "Brokerage rate updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getBrokerHouseByName = async (req, res) => {
  try {
    const brokerHouse = await brokerHouseModel.findOne({
      name: req.params.name,
    });
    if (!brokerHouse) {
      return res.status(404).json({ message: "BrokerHouse not found" });
    }
    res.status(200).json(brokerHouse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

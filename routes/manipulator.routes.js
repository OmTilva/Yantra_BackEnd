const express = require("express");
const router = express.Router();
const { addManipulator } = require("../controller/manipulator.controller");

router.post("/add", addManipulator);

module.exports = router;

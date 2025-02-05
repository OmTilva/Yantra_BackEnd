const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectToDb = require("./db/db");
connectToDb();

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const stockRoute = require("./routes/stocks.routes");
const searchRoute = require("./routes/search.routes");
const logsRoute = require("./routes/logs.routes");
const brokerHouseRoutes = require("./routes/brokerHouse.routes");
const manipulatorRoutes = require("./routes/manipulator.routes"); // Import manipulator routes

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.use("/auth", authRoutes);

app.use("/users", userRoutes);

app.use("/stocks", stockRoute);

app.use("/search", searchRoute);

app.use("/logs", logsRoute);

app.use("/brokerhouse", brokerHouseRoutes);

app.use("/manipulator", manipulatorRoutes); // Register manipulator routes

module.exports = app;

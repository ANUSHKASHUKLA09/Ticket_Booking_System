require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const startScheduler = require("./utils/seatHoldScheduler");

const authRoutes = require("./routes/authRoutes");
const venueRoutes = require("./routes/venueRoutes");
const showRoutes = require("./routes/showRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const waitlistRoutes = require("./routes/waitlistRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/waitlist", waitlistRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Catch-all error handler (anything that slips past individual try/catch blocks)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  startScheduler(); // begins the every-minute sweep for expired holds/offers
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start();

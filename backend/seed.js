// Run once: node seed.js
// Creates a single admin account directly in the DB (admins aren't allowed to self-register
// via the public /api/auth/register endpoint — that's a deliberate security choice).
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: "admin@example.com" });
  if (existing) {
    console.log("Admin already exists:", existing.email);
  } else {
    const admin = await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: "admin123", // CHANGE THIS after first login — it's hashed automatically on save
      role: "admin",
    });
    console.log("Admin created:", admin.email, "(password: admin123)");
  }

  await mongoose.disconnect();
}

seed();

const Venue = require("../models/Venue");

// POST /api/venues  (admin only)
// Body: { name, address, seatLayout: [{row, number, category}, ...] }
async function createVenue(req, res) {
  try {
    const { name, address, seatLayout } = req.body;
    if (!name || !Array.isArray(seatLayout) || seatLayout.length === 0) {
      return res.status(400).json({ message: "name and a non-empty seatLayout are required" });
    }

    const venue = await Venue.create({
      name,
      address,
      seatLayout,
      createdBy: req.user._id,
    });

    res.status(201).json(venue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/venues
async function listVenues(req, res) {
  const venues = await Venue.find().select("name address seatLayout createdAt");
  res.json(venues);
}

// GET /api/venues/:id
async function getVenue(req, res) {
  const venue = await Venue.findById(req.params.id);
  if (!venue) return res.status(404).json({ message: "Venue not found" });
  res.json(venue);
}

module.exports = { createVenue, listVenues, getVenue };

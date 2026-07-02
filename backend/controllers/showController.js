const Show = require("../models/Show");
const Venue = require("../models/Venue");
const ShowSeat = require("../models/ShowSeat");

// POST /api/shows  (organiser only)
// Body: { title, type, venue, date, time, pricing: { Premium: 500, Standard: 200 } }
async function createShow(req, res) {
  try {
    const { title, type, venue: venueId, date, time, pricing } = req.body;
    if (!title || !type || !venueId || !date || !time || !pricing) {
      return res.status(400).json({ message: "title, type, venue, date, time, pricing are all required" });
    }

    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ message: "Venue not found" });

    const show = await Show.create({
      title,
      type,
      venue: venueId,
      organiser: req.user._id,
      date,
      time,
      pricing,
    });

    // IMPORTANT: generate one ShowSeat document per physical seat in the venue,
    // for THIS show specifically. This is what lets the same venue host many
    // shows in parallel, each with independent seat status.
    const seatDocs = venue.seatLayout.map((seat) => ({
      show: show._id,
      row: seat.row,
      number: seat.number,
      category: seat.category,
      price: pricing[seat.category] ?? 0,
      status: "available",
    }));
    await ShowSeat.insertMany(seatDocs);

    res.status(201).json(show);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/shows?type=movie&date=2026-07-10
async function listShows(req, res) {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.date) {
    const start = new Date(req.query.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.date = { $gte: start, $lt: end };
  }

  const shows = await Show.find(filter).populate("venue", "name address").sort({ date: 1 });
  res.json(shows);
}

// GET /api/shows/:id
async function getShow(req, res) {
  const show = await Show.findById(req.params.id).populate("venue", "name address");
  if (!show) return res.status(404).json({ message: "Show not found" });
  res.json(show);
}

// GET /api/shows/:id/revenue  (organiser only - their own show)
async function getShowRevenue(req, res) {
  const Booking = require("../models/Booking");
  const show = await Show.findById(req.params.id);
  if (!show) return res.status(404).json({ message: "Show not found" });
  if (String(show.organiser) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not your show" });
  }

  const bookings = await Booking.find({ show: show._id, status: "confirmed" });
  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const seatsSold = bookings.reduce((sum, b) => sum + b.seats.length, 0);

  res.json({ show: show.title, totalRevenue, seatsSold, totalBookings: bookings.length });
}

module.exports = { createShow, listShows, getShow, getShowRevenue };

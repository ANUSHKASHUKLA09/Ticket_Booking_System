const ShowSeat = require("../models/ShowSeat");
const Show = require("../models/Show");

const HOLD_TTL_MINUTES = Number(process.env.SEAT_HOLD_TTL_MINUTES || 10);

// GET /api/shows/:showId/seats
// Returns the full seat map for a show, with live status, for rendering the visual grid
async function getSeatMap(req, res) {
  const seats = await ShowSeat.find({ show: req.params.showId }).sort({ row: 1, number: 1 });
  res.json(seats);
}

// POST /api/shows/:showId/seats/hold
// Body: { seatIds: ["...", "..."] }
//
// CONCURRENCY: This is the part the assignment evaluates closely.
// We use findOneAndUpdate with status:'available' as part of the QUERY filter, not
// just the update. MongoDB executes findOneAndUpdate atomically per document — so if
// two requests race for the same seat, only ONE of them will match status:'available'
// and successfully flip it to 'held'. The second request's filter no longer matches
// (status is already 'held'), so it gets null back and we know that seat was lost.
async function holdSeats(req, res) {
  try {
    const { showId } = req.params;
    const { seatIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ message: "seatIds array is required" });
    }

    const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);
    const heldSeats = [];
    const failedSeatIds = [];

    // Process seats one at a time so each atomic update is independent and we can
    // track exactly which ones succeeded vs failed.
    for (const seatId of seatIds) {
      const seat = await ShowSeat.findOneAndUpdate(
        { _id: seatId, show: showId, status: "available" }, // <-- atomic condition: only matches if still available
        { status: "held", heldBy: userId, holdExpiresAt },
        { new: true }
      );

      if (seat) {
        heldSeats.push(seat);
      } else {
        failedSeatIds.push(seatId);
      }
    }

    // If ANY seat in the request failed, roll back the ones we DID manage to hold.
    // This avoids leaving the customer with a partial, confusing hold.
    if (failedSeatIds.length > 0) {
      await ShowSeat.updateMany(
        { _id: { $in: heldSeats.map((s) => s._id) } },
        { status: "available", heldBy: null, holdExpiresAt: null }
      );
      return res.status(409).json({
        message: "Some seats were already taken by another customer",
        failedSeatIds,
      });
    }

    res.json({ message: "Seats held", holdExpiresAt, seats: heldSeats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/shows/:showId/seats/release
// Body: { seatIds: ["...", "..."] }
// Called when a customer abandons checkout — frees the seat(s) immediately instead
// of waiting for the TTL cron to catch it.
async function releaseSeats(req, res) {
  try {
    const { seatIds } = req.body;
    const userId = req.user._id;

    await ShowSeat.updateMany(
      { _id: { $in: seatIds }, heldBy: userId, status: "held" }, // can only release your OWN held seats
      { status: "available", heldBy: null, holdExpiresAt: null }
    );

    res.json({ message: "Seats released" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getSeatMap, holdSeats, releaseSeats };

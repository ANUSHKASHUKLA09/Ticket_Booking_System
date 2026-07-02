const crypto = require("crypto");
const ShowSeat = require("../models/ShowSeat");
const Show = require("../models/Show");
const Booking = require("../models/Booking");
const Waitlist = require("../models/Waitlist");
const generateQRCode = require("../utils/qrGenerator");
const { sendBookingConfirmation, sendWaitlistOffer } = require("../utils/emailService");

function makeBookingRef() {
  return "BK-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

// POST /api/bookings/confirm
// Body: { showId, seatIds: [...] }
// Converts the customer's currently-held (or offered-to-them) seats into a confirmed booking.
async function confirmBooking(req, res) {
  try {
    const { showId, seatIds } = req.body;
    const userId = req.user._id;

    const show = await Show.findById(showId);
    if (!show) return res.status(404).json({ message: "Show not found" });

    // Only allow confirming seats that are currently held BY THIS USER and not expired,
    // OR offered to this user via the waitlist flow and not expired.
    const now = new Date();
    const seats = await ShowSeat.find({
      _id: { $in: seatIds },
      show: showId,
      $or: [
        { status: "held", heldBy: userId, holdExpiresAt: { $gt: now } },
        { status: "offered", offeredTo: userId, offerExpiresAt: { $gt: now } },
      ],
    });

    if (seats.length !== seatIds.length) {
      return res.status(409).json({
        message: "One or more seats are no longer held by you (hold may have expired). Please reselect.",
      });
    }

    const totalAmount = seats.reduce((sum, s) => sum + s.price, 0);
    const bookingRef = makeBookingRef();
    const qrCodeDataUrl = await generateQRCode(bookingRef);

    const booking = await Booking.create({
      bookingRef,
      user: userId,
      show: showId,
      seats: seats.map((s) => s._id),
      totalAmount,
      status: "confirmed",
      qrCodeDataUrl,
    });

    await ShowSeat.updateMany(
      { _id: { $in: seats.map((s) => s._id) } },
      { status: "booked", booking: booking._id, holdExpiresAt: null, offerExpiresAt: null }
    );

    // If this booking came from a waitlist offer, mark that waitlist entry fulfilled
    await Waitlist.updateMany(
      { user: userId, show: showId, status: "offered" },
      { status: "fulfilled" }
    );

    // Email is best-effort — don't fail the booking if email sending has an issue
    try {
      await sendBookingConfirmation(req.user.email, booking, show);
    } catch (emailErr) {
      console.error("Email send failed:", emailErr.message);
    }

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/bookings/my
async function myBookings(req, res) {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("show", "title date time")
    .populate("seats", "row number category")
    .sort({ createdAt: -1 });
  res.json(bookings);
}

// POST /api/bookings/:id/cancel
// Cancels a booking, frees the seats, and triggers the waitlist auto-assignment.
async function cancelBooking(req, res) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (String(booking.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not your booking" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Already cancelled" });
    }

    const seats = await ShowSeat.find({ _id: { $in: booking.seats } });
    booking.status = "cancelled";
    await booking.save();

    // For each freed seat, check the waitlist for that category. If someone is waiting,
    // offer the seat to them instead of just marking it available — that's the
    // "automatic seat assignment on cancellation" requirement.
    for (const seat of seats) {
      await offerSeatToWaitlist(seat);
    }

    res.json({ message: "Booking cancelled, seats processed for waitlist/release" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Shared helper: given a freed seat, either offer it to the next waitlisted person
// for that show+category, or mark it plain available if nobody is waiting.
// Exported so the cron scheduler can reuse it when an "offered" seat's timer expires.
async function offerSeatToWaitlist(seat) {
  const next = await Waitlist.findOne({
    show: seat.show,
    category: seat.category,
    status: "waiting",
  }).sort({ position: 1 }); // FIFO — earliest joiner first

  if (!next) {
    // nobody waiting — just release the seat normally
    seat.status = "available";
    seat.heldBy = null;
    seat.holdExpiresAt = null;
    seat.offeredTo = null;
    seat.offerExpiresAt = null;
    await seat.save();
    return;
  }

  const ttlMinutes = Number(process.env.WAITLIST_OFFER_TTL_MINUTES || 15);
  const offerExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  seat.status = "offered";
  seat.heldBy = null;
  seat.holdExpiresAt = null;
  seat.offeredTo = next.user;
  seat.offerExpiresAt = offerExpiresAt;
  await seat.save();

  next.status = "offered";
  next.offeredSeat = seat._id;
  next.offerExpiresAt = offerExpiresAt;
  await next.save();

  const User = require("../models/User");
  const Show = require("../models/Show");
  const [user, show] = await Promise.all([User.findById(next.user), Show.findById(seat.show)]);

  const claimLink = `${process.env.FRONTEND_URL}/shows/${seat.show}?claimSeat=${seat._id}`;
  try {
    await sendWaitlistOffer(user.email, show, offerExpiresAt, claimLink);
  } catch (emailErr) {
    console.error("Waitlist offer email failed:", emailErr.message);
  }
}

module.exports = { confirmBooking, myBookings, cancelBooking, offerSeatToWaitlist };

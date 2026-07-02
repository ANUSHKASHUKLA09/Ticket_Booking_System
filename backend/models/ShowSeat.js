const mongoose = require("mongoose");

/**
 * One document per seat, per show.
 * This is where concurrency control happens — read the comments below carefully.
 *
 * status lifecycle:
 *   available -> held -> booked
 *   held -> available        (hold expires / customer abandons checkout)
 *   available -> offered      (waitlist: seat offered to next person after a cancellation)
 *   offered -> booked         (waitlisted customer completes booking in time)
 *   offered -> offered (next) (waitlisted customer misses the time limit, goes to next person)
 */
const showSeatSchema = new mongoose.Schema(
  {
    show: { type: mongoose.Schema.Types.ObjectId, ref: "Show", required: true },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },

    status: {
      type: String,
      enum: ["available", "held", "booked", "offered"],
      default: "available",
    },

    // who currently has this seat held / offered (null when available)
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    holdExpiresAt: { type: Date, default: null },

    // used only when status = "offered" (waitlist flow)
    offeredTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    offerExpiresAt: { type: Date, default: null },

    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

// One seat (row+number) can only exist once per show — prevents duplicate seat docs
showSeatSchema.index({ show: 1, row: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("ShowSeat", showSeatSchema);

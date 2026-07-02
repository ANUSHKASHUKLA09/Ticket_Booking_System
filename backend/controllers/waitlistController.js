const Waitlist = require("../models/Waitlist");
const ShowSeat = require("../models/ShowSeat");

// POST /api/waitlist
// Body: { showId, category }
// Customer joins the waitlist for a category that's sold out (no 'available' seats left).
async function joinWaitlist(req, res) {
  try {
    const { showId, category } = req.body;
    const userId = req.user._id;

    const availableCount = await ShowSeat.countDocuments({
      show: showId,
      category,
      status: "available",
    });
    if (availableCount > 0) {
      return res.status(400).json({ message: "Seats are still available in this category — no need to wait" });
    }

    const alreadyOnList = await Waitlist.findOne({
      show: showId,
      category,
      user: userId,
      status: { $in: ["waiting", "offered"] },
    });
    if (alreadyOnList) {
      return res.status(409).json({ message: "You're already on the waitlist for this category" });
    }

    // position = current queue length + 1, keeps FIFO order
    const queueLength = await Waitlist.countDocuments({ show: showId, category, status: "waiting" });

    const entry = await Waitlist.create({
      show: showId,
      category,
      user: userId,
      position: queueLength + 1,
    });

    res.status(201).json({ message: "Added to waitlist", position: entry.position, entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/waitlist/my
async function myWaitlistEntries(req, res) {
  const entries = await Waitlist.find({ user: req.user._id })
    .populate("show", "title date time")
    .sort({ createdAt: -1 });
  res.json(entries);
}

module.exports = { joinWaitlist, myWaitlistEntries };

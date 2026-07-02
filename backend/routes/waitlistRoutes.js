const express = require('express');
const { authenticate } = require('../middleware/auth');
const Waitlist = require('../models/Waitlist');
const Show = require('../models/Show');

const router = express.Router();

router.post('/join', authenticate, async (req, res) => {
  try {
    const { showId, category } = req.body;

    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    const existing = await Waitlist.findOne({
      showId,
      userId: req.userId,
      category,
      status: { $in: ['waiting', 'offered'] }
    });

    if (existing) {
      return res.status(400).json({ message: 'Already on waitlist for this category' });
    }

    const count = await Waitlist.countDocuments({
      showId,
      category,
      status: 'waiting'
    });

    const waitlistEntry = await Waitlist.create({
      showId,
      userId: req.userId,
      category,
      position: count + 1,
      status: 'waiting'
    });

    res.status(201).json({
      message: 'Added to waitlist',
      position: count + 1,
      waitlistEntry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my-status', authenticate, async (req, res) => {
  try {
    const entries = await Waitlist.find({ 
      userId: req.userId,
      status: { $in: ['waiting', 'offered'] }
    }).populate('showId', 'title date time');
    
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
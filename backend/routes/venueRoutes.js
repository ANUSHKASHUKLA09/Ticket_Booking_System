const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const Venue = require('../models/Venue');

const router = express.Router();

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const venue = await Venue.create({
      ...req.body,
      createdBy: req.userId
    });
    res.status(201).json(venue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const venues = await Venue.find();
    res.json(venues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const Show = require('../models/Show');
const Venue = require('../models/Venue');

const router = express.Router();

router.post('/', authenticate, authorize('organiser', 'admin'), async (req, res) => {
  try {
    const { venueId, title, description, type, date, time, basePrice } = req.body;
    
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const seats = [];
    for (let row = 1; row <= venue.totalRows; row++) {
      for (let num = 1; num <= venue.seatsPerRow; num++) {
        const category = row <= 2 ? 'Premium' : 'Standard';
        seats.push({
          row,
          number: num,
          category,
          status: 'available'
        });
      }
    }

    const show = await Show.create({
      title,
      description,
      type,
      date,
      time,
      venueId,
      organiserId: req.userId,
      basePrice,
      seats
    });

    res.status(201).json(show);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const shows = await Show.find()
      .populate('venueId', 'name')
      .populate('organiserId', 'name');
    res.json(shows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const show = await Show.findById(req.params.id)
      .populate('venueId', 'name')
      .populate('organiserId', 'name');
    
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }
    
    res.json(show);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
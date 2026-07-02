const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const Show = require('../models/Show');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { sendBookingConfirmation } = require('../utils/emailService');

const router = express.Router();

// ===== GENERATE UNIQUE REFERENCE =====
const generateUniqueReference = async () => {
  // Use timestamp + multiple random components
  const timestamp = Date.now();
  const random1 = Math.random().toString(36).substring(2, 8).toUpperCase();
  const random2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const random3 = Math.floor(Math.random() * 10000);
  const reference = `BK-${timestamp}-${random1}-${random2}-${random3}`;
  
  // Check if reference already exists
  const existing = await Booking.findOne({ reference });
  if (existing) {
    // If exists, recursively generate new one (with delay to avoid infinite loop)
    await new Promise(resolve => setTimeout(resolve, 10));
    return generateUniqueReference();
  }
  
  return reference;
};

// ===== HOLD SEATS =====
router.post('/hold', authenticate, async (req, res) => {
  try {
    const { showId, seatIds } = req.body;
    
    console.log('🔒 Hold request:', { showId, seatIds, userId: req.userId });
    
    if (!seatIds || seatIds.length === 0) {
      return res.status(400).json({ message: 'No seats selected' });
    }

    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    const holdExpiry = new Date();
    holdExpiry.setMinutes(holdExpiry.getMinutes() + 10);

    let heldSeats = [];
    const errors = [];

    for (const seatId of seatIds) {
      const [row, number] = seatId.split('-').map(Number);
      const seat = show.seats.find(s => s.row === row && s.number === number);
      
      if (!seat) {
        errors.push(`Seat ${seatId} not found`);
        continue;
      }
      
      if (seat.status !== 'available') {
        errors.push(`Seat ${row}-${number} is already ${seat.status}`);
        continue;
      }

      seat.status = 'held';
      seat.heldBy = req.userId;
      seat.heldUntil = holdExpiry;
      heldSeats.push(seatId);
    }

    if (heldSeats.length === 0) {
      return res.status(400).json({ 
        message: 'No seats could be held', 
        errors 
      });
    }

    await show.save();
    
    console.log('✅ Seats held:', heldSeats);

    res.json({
      message: `Held ${heldSeats.length} seats for 10 minutes`,
      heldSeats,
      expiresAt: holdExpiry,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Hold error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ===== RELEASE HELD SEATS =====
router.post('/release', authenticate, async (req, res) => {
  try {
    const { showId } = req.body;
    
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    let released = 0;
    show.seats = show.seats.map(seat => {
      if (seat.status === 'held' && seat.heldBy?.toString() === req.userId) {
        released++;
        return {
          ...seat,
          status: 'available',
          heldBy: null,
          heldUntil: null
        };
      }
      return seat;
    });

    if (released > 0) {
      await show.save();
    }

    res.json({ message: `Released ${released} held seats` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== CONFIRM BOOKING (FIXED) =====
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { showId, seatIds } = req.body;
    
    console.log('📝 Booking request:', { showId, seatIds, userId: req.userId });
    
    // Validate input
    if (!showId) {
      return res.status(400).json({ message: 'Show ID is required' });
    }
    
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ message: 'At least one seat is required' });
    }

    // Find show
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let totalAmount = 0;
    let confirmedSeats = [];

    // Verify and book each seat
    for (const seatId of seatIds) {
      const [row, number] = seatId.split('-').map(Number);
      const seat = show.seats.find(s => s.row === row && s.number === number);
      
      if (!seat) {
        return res.status(400).json({ message: `Seat ${seatId} not found` });
      }
      
      if (seat.status !== 'held') {
        return res.status(400).json({ 
          message: `Seat ${seatId} is not held. Please hold seats again.` 
        });
      }
      
      if (seat.heldBy?.toString() !== req.userId) {
        return res.status(400).json({ 
          message: `Seat ${seatId} is held by another user.` 
        });
      }

      // Calculate price
      const price = seat.category === 'Premium' 
        ? show.basePrice * 1.5 
        : show.basePrice;
      
      totalAmount += price;
      
      // Book the seat
      seat.status = 'booked';
      seat.bookedBy = req.userId;
      confirmedSeats.push(seatId);
    }

    // ✅ Generate unique reference using the function
    const reference = await generateUniqueReference();
    console.log('📝 Generated reference:', reference);

    // Create booking
    const booking = new Booking({
      reference,
      userId: req.userId,
      showId,
      seatIds: confirmedSeats,
      totalAmount,
      status: 'confirmed'
    });

    await booking.save();
    await show.save();

    console.log('✅ Booking created:', booking._id);

    // Send email with QR code
    try {
      await sendBookingConfirmation(user.email, booking, show.title);
      console.log('📧 Email sent to:', user.email);
    } catch (emailError) {
      console.error('Email error (non-critical):', emailError.message);
    }

    res.status(201).json({
      message: 'Booking confirmed!',
      booking: {
        _id: booking._id,
        reference: booking.reference,
        seatIds: booking.seatIds,
        totalAmount: booking.totalAmount,
        status: booking.status,
        bookedAt: booking.bookedAt
      }
    });

  } catch (error) {
    console.error('❌ Booking error:', error.message);
    console.error('Stack:', error.stack);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      // Try one more time with a new reference
      try {
        const { showId, seatIds } = req.body;
        const show = await Show.findById(showId);
        const user = await User.findById(req.userId);
        let totalAmount = 0;
        
        for (const seatId of seatIds) {
          const [row, number] = seatId.split('-').map(Number);
          const seat = show.seats.find(s => s.row === row && s.number === number);
          if (seat) {
            totalAmount += seat.category === 'Premium' ? show.basePrice * 1.5 : show.basePrice;
          }
        }
        
        // Generate new reference with extra randomness
        const newRef = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.floor(Math.random() * 99999)}-${Date.now() % 1000}`;
        
        const booking = new Booking({
          reference: newRef,
          userId: req.userId,
          showId,
          seatIds,
          totalAmount,
          status: 'confirmed'
        });
        
        await booking.save();
        await show.save();
        
        try {
          await sendBookingConfirmation(user.email, booking, show.title);
        } catch (emailError) {
          console.error('Email error:', emailError);
        }
        
        return res.status(201).json({
          message: 'Booking confirmed!',
          booking: {
            _id: booking._id,
            reference: booking.reference,
            seatIds: booking.seatIds,
            totalAmount: booking.totalAmount,
            status: booking.status,
            bookedAt: booking.bookedAt
          }
        });
      } catch (retryError) {
        console.error('Retry error:', retryError);
        return res.status(500).json({ message: 'Booking failed. Please try again.' });
      }
    }
    
    res.status(500).json({ 
      message: 'Payment failed: ' + error.message 
    });
  }
});

// ===== GET USER BOOKINGS =====
router.get('/my-bookings', authenticate, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.userId })
      .populate('showId', 'title date time')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== CANCEL BOOKING =====
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }

    booking.status = 'cancelled';
    await booking.save();

    const show = await Show.findById(booking.showId);
    if (show) {
      show.seats = show.seats.map(seat => {
        const seatId = `${seat.row}-${seat.number}`;
        if (booking.seatIds.includes(seatId)) {
          return {
            ...seat,
            status: 'available',
            bookedBy: null,
            heldBy: null,
            heldUntil: null
          };
        }
        return seat;
      });
      await show.save();

      const { assignNextWaitlist } = require('../utils/seatHoldScheduler');
      const categories = ['Premium', 'Standard'];
      for (const category of categories) {
        await assignNextWaitlist(show._id, category);
      }
    }

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== REVENUE DASHBOARD =====
router.get('/revenue', authenticate, authorize('organiser', 'admin'), async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      status: 'confirmed' 
    }).populate('showId', 'title organiserId');
    
    let userBookings = bookings;
    if (req.user.role === 'organiser') {
      userBookings = bookings.filter(b => 
        b.showId?.organiserId?.toString() === req.userId
      );
    }

    const totalRevenue = userBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const byEvent = {};
    userBookings.forEach(b => {
      if (b.showId) {
        const key = b.showId._id.toString();
        if (!byEvent[key]) {
          byEvent[key] = { 
            title: b.showId.title, 
            revenue: 0, 
            count: 0 
          };
        }
        byEvent[key].revenue += b.totalAmount;
        byEvent[key].count++;
      }
    });
    
    res.json({
      totalRevenue,
      totalBookings: userBookings.length,
      byEvent: Object.values(byEvent)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
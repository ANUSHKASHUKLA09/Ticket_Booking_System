const cron = require('node-cron');
const Show = require('../models/Show');
const Waitlist = require('../models/Waitlist');
const { sendWaitlistOfferEmail } = require('./emailService');

const startScheduler = () => {
  cron.schedule('* * * * *', async () => {
    console.log('🔄 Running seat hold cleanup...');
    await releaseExpiredHolds();
    await processWaitlistOffers();
  });
};

const releaseExpiredHolds = async () => {
  try {
    const now = new Date();
    
    const shows = await Show.find({
      'seats.heldUntil': { $lt: now }
    });

    for (const show of shows) {
      let updated = false;
      
      show.seats = show.seats.map(seat => {
        if (seat.status === 'held' && seat.heldUntil < now) {
          updated = true;
          return {
            ...seat,
            status: 'available',
            heldBy: null,
            heldUntil: null
          };
        }
        return seat;
      });

      if (updated) {
        await show.save();
        console.log(`✅ Released expired holds for show: ${show.title}`);
      }
    }
  } catch (error) {
    console.error('❌ Error releasing holds:', error.message);
  }
};

const processWaitlistOffers = async () => {
  try {
    const now = new Date();
    
    // Find expired offers
    const expiredOffers = await Waitlist.find({
      status: 'offered',
      offerExpiresAt: { $lt: now }
    });

    for (const offer of expiredOffers) {
      offer.status = 'expired';
      await offer.save();
      
      // Reassign seat from this offer to next in queue
      await assignNextWaitlist(offer.showId, offer.category);
    }

    // Check for shows with available seats and waiting customers
    const shows = await Show.find({
      'seats.status': 'available'
    });

    for (const show of shows) {
      const categories = ['Premium', 'Standard'];
      
      for (const category of categories) {
        // Check if there are available seats in this category
        const availableSeats = show.seats.filter(
          s => s.status === 'available' && s.category === category
        );

        if (availableSeats.length > 0) {
          // Find the next waiting customer
          const nextWaiting = await Waitlist.findOne({
            showId: show._id,
            category: category,
            status: 'waiting'
          }).sort({ position: 1 });

          if (nextWaiting) {
            await offerSeatToWaitlist(nextWaiting, show, category);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing waitlist:', error.message);
  }
};

const offerSeatToWaitlist = async (waitlistEntry, show, category) => {
  try {
    // Find an available seat in this category
    const availableSeat = show.seats.find(
      s => s.status === 'available' && s.category === category
    );

    if (!availableSeat) return;

    // Hold the seat for the waitlist customer
    const offerExpiry = new Date();
    offerExpiry.setMinutes(offerExpiry.getMinutes() + 15); // 15 minute offer

    availableSeat.status = 'held';
    availableSeat.heldBy = waitlistEntry.userId;
    availableSeat.heldUntil = offerExpiry;

    await show.save();

    // Update waitlist entry
    waitlistEntry.status = 'offered';
    waitlistEntry.offeredAt = new Date();
    waitlistEntry.offerExpiresAt = offerExpiry;
    await waitlistEntry.save();

    // Send email notification
    await sendWaitlistOfferEmail(
      waitlistEntry.userId,
      show.title,
      category,
      offerExpiry
    );

    console.log(`📧 Waitlist offer sent for ${show.title} - ${category}`);
  } catch (error) {
    console.error('❌ Error offering seat:', error.message);
  }
};

const assignNextWaitlist = async (showId, category) => {
  try {
    const nextWaiting = await Waitlist.findOne({
      showId: showId,
      category: category,
      status: 'waiting'
    }).sort({ position: 1 });

    if (nextWaiting) {
      const show = await Show.findById(showId);
      if (show) {
        await offerSeatToWaitlist(nextWaiting, show, category);
      }
    }
  } catch (error) {
    console.error('❌ Error assigning next waitlist:', error.message);
  }
};

module.exports = startScheduler;
module.exports.assignNextWaitlist = assignNextWaitlist;
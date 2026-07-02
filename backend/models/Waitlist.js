const mongoose = require('mongoose');

const WaitlistSchema = new mongoose.Schema({
  showId: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, enum: ['Premium', 'Standard'], required: true },
  status: { 
    type: String, 
    enum: ['waiting', 'offered', 'expired', 'fulfilled'], 
    default: 'waiting' 
  },
  offeredAt: { type: Date },
  offerExpiresAt: { type: Date },
  position: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

WaitlistSchema.index({ showId: 1, category: 1, position: 1 });

module.exports = mongoose.model('Waitlist', WaitlistSchema);
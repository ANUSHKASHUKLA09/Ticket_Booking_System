const mongoose = require('mongoose');

const ShowSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['movie', 'concert'], required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  organiserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  basePrice: { type: Number, required: true },
  seats: [{
    row: { type: Number, required: true },
    number: { type: Number, required: true },
    category: { type: String, enum: ['Premium', 'Standard'], required: true },
    status: { 
      type: String, 
      enum: ['available', 'held', 'booked'], 
      default: 'available' 
    },
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    heldUntil: { type: Date },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Show', ShowSchema);
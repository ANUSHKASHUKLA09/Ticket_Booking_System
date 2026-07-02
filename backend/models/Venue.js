const mongoose = require('mongoose');

const VenueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  totalRows: { type: Number, required: true },
  seatsPerRow: { type: Number, required: true },
  categories: [{
    name: { type: String, enum: ['Premium', 'Standard'], required: true },
    priceMultiplier: { type: Number, default: 1.0 }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Venue', VenueSchema);
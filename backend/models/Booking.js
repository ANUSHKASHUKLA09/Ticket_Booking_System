const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    reference: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    showId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Show', 
        required: true 
    },
    seatIds: [{ 
        type: String 
    }],
    totalAmount: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'cancelled', 'expired'], 
        default: 'confirmed' 
    },
    qrCode: { 
        type: String 
    },
    expiresAt: { 
        type: Date 
    },
    bookedAt: { 
        type: Date, 
        default: Date.now 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
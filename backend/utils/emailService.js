const QRCode = require('qrcode');

// Simple email service (mock for testing)
const sendBookingConfirmation = async (userEmail, booking, showTitle) => {
  try {
    const qrCodeData = await QRCode.toDataURL(booking.reference);
    console.log('📧 ===== EMAIL CONFIRMATION =====');
    console.log('📧 To:', userEmail);
    console.log('📧 Subject: Ticket Confirmation -', showTitle);
    console.log('📧 Reference:', booking.reference);
    console.log('📧 Seats:', booking.seatIds.join(', '));
    console.log('📧 Total:', booking.totalAmount);
    console.log('📧 QR Code generated successfully');
    console.log('📧 ================================');
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
};

const sendWaitlistOfferEmail = async (userId, showTitle, category, expiresAt) => {
  try {
    console.log('📧 ===== WAITLIST OFFER =====');
    console.log('📧 User ID:', userId);
    console.log('📧 Show:', showTitle);
    console.log('📧 Category:', category);
    console.log('📧 Expires:', expiresAt);
    console.log('📧 =========================');
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
};

module.exports = {
  sendBookingConfirmation,
  sendWaitlistOfferEmail
};
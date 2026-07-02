const QRCode = require("qrcode");

// Encodes the booking reference into a QR code, returns it as a base64 data URL
// (so we can both email it as an attachment and store it for booking history)
async function generateQRCode(bookingRef) {
  const dataUrl = await QRCode.toDataURL(bookingRef, {
    errorCorrectionLevel: "H",
    width: 300,
  });
  return dataUrl; // looks like "data:image/png;base64,...."
}

module.exports = generateQRCode;

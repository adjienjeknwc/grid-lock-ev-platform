const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  stationName: String,
  pricePaid: Number,
  username: String,
  paymentMethod: String,
  vehicleType: { type: String, default: "Car" }, // Added Vehicle Type
  invoiceId: String,
  date: { type: Date, default: Date.now },
  status: { type: String, default: "Completed" }
});

module.exports = mongoose.model('Booking', BookingSchema);
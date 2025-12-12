const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
  name: String,
  hostName: String, // NEW FIELD
  adharId: String,  // NEW FIELD
  timings: String,  // NEW FIELD
  address: String,
  hostPhone: String,
  location: {
    lat: Number,
    lng: Number
  },
  basePrice: Number,
  currentPrice: Number,
  status: { type: String, default: "Open" }, // Default status
  isAuctioning: { type: Boolean, default: false },
  reviews: [
    {
      user: String,
      rating: Number,
      comment: String
    }
  ],
  bids: []
});

module.exports = mongoose.model('Station', StationSchema);
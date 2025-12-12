const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  userId: { type: String, default: "demo_user" }, // Hardcoded for this project
  balance: { type: Number, default: 1000 }
});

module.exports = mongoose.model('Wallet', WalletSchema);
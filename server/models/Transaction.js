const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  username: String,
  type: String,    // "CREDIT" (Add Money) or "DEBIT" (Payment)
  amount: Number,
  description: String, // e.g. "Added funds", "Paid for Station X"
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
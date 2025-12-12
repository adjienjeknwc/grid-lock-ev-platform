const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const User = require('./models/User');
const Station = require('./models/Station');
const Booking = require('./models/Booking');
const Transaction = require('./models/Transaction');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// --- SOCKET.IO SETUP (FIXED) ---
// We declare 'io' only ONCE here.
// 'origin: "*"' allows connections from any frontend (localhost or deployed).
const io = new Server(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  }
});

// REPLACE WITH YOUR MONGO URI
const MONGO_URI = 'mongodb+srv://admin:password1234@admin.qv5es5r.mongodb.net/?appName=admin'; 

mongoose.connect(MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ DB Error:", err));

// --- SOCKET.IO LOGIC (Real-time Bids) ---
io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("place_bid", async (data) => {
    const { stationId, amount } = data;
    // Update price in database
    const station = await Station.findById(stationId);
    if(station) {
        station.currentPrice = amount;
        await station.save();
        // Broadcast new price to EVERYONE connected
        io.emit("price_update", station); 
    }
  });
});

// --- API ROUTES ---

// 1. GET ALL STATIONS
app.get('/api/stations', async (req, res) => {
  try {
    const stations = await Station.find();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// 2. ADD A NEW STATION (HOST)
app.post('/api/stations', async (req, res) => {
  try {
    const newStation = new Station({ ...req.body, currentPrice: req.body.basePrice });
    await newStation.save();
    io.emit("global_update", newStation); // Tell frontends a new pin dropped
    res.json(newStation);
  } catch (err) {
    res.status(500).json({ error: "Failed to add station" });
  }
});

// 3. LOGIN / SIGNUP
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) res.json(user);
    else res.status(400).json({ error: "User not found" });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    // Check if user already exists to prevent duplicates
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Username already taken" });

    const user = new User({ username, password, walletBalance: 1000 }); // Free ₹1000 on signup
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Signup Failed" });
  }
});

// 4. RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        const user = await User.findOneAndUpdate({ username }, { password: newPassword });
        if(user) res.json({ success: true });
        else res.status(404).json({ error: "User not found" });
    } catch (err) {
        res.status(500).json({ error: "Reset Failed" });
    }
});

// 5. BOOK A STATION
app.post('/api/bookings', async (req, res) => {
  try {
    const { stationName, price, paymentMethod, username, vehicleType } = req.body;
    
    // Deduct from Wallet if that method is chosen
    // Note: We treat "GPay/UPI" as wallet deduction here for simplicity, 
    // or you can skip this block if UPI shouldn't deduct from app wallet.
    if (paymentMethod === "Grid-Lock Wallet" || paymentMethod === "GPay/UPI") { 
        const user = await User.findOne({ username });
        if (user.walletBalance < price) return res.status(400).json({ error: "Insufficient Funds" });
        
        user.walletBalance -= price;
        await user.save();

        // Log Transaction
        await Transaction.create({
            username, type: "DEBIT", amount: price, description: `Paid for ${stationName}`
        });
    }

    const invoiceId = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const newBooking = new Booking({
      stationName, pricePaid: price, paymentMethod, username, vehicleType, invoiceId
    });

    await newBooking.save();
    res.status(201).json(newBooking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Booking Failed" });
  }
});

// 6. GET USER WALLET
app.get('/api/wallet/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        res.json({ balance: user ? user.walletBalance : 0 });
    } catch (err) {
        res.status(500).json({ error: "Wallet Error" });
    }
});

// 7. ADD MONEY TO WALLET
app.post('/api/wallet/add', async (req, res) => {
    try {
        const { username, amount } = req.body;
        const user = await User.findOne({ username });
        if(user) {
            user.walletBalance += amount;
            await user.save();
            
            await Transaction.create({
                username, type: "CREDIT", amount: amount, description: "Wallet Top-up"
            });
            
            res.json({ balance: user.walletBalance });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Add Funds Failed" });
    }
});

// 8. GET TRANSACTIONS
app.get('/api/transactions/:username', async (req, res) => {
    try {
        const history = await Transaction.find({ username: req.params.username }).sort({ date: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "History Error" });
    }
});

// 9. ADD REVIEW
app.post('/api/stations/:id/reviews', async (req, res) => {
    try {
        const { user, rating, comment } = req.body;
        const station = await Station.findById(req.params.id);
        if(station) {
            station.reviews.push({ user, rating, comment });
            await station.save();
            res.json(station);
        } else {
            res.status(404).json({ error: "Station not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Review Failed" });
    }
});

server.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});
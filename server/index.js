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
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});

// REPLACE WITH YOUR MONGO URI
const MONGO_URI = 'mongodb+srv://admin:password1234@admin.qv5es5r.mongodb.net/?appName=admin'; 

mongoose.connect(MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ DB Error:", err));

// --- SOCKET.IO (Real-time Bids) ---
io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("place_bid", async (data) => {
    const { stationId, amount } = data;
    // Update price in memory/DB (Simplified for demo)
    const station = await Station.findById(stationId);
    if(station) {
        station.currentPrice = amount;
        await station.save();
        // Broadcast new price to EVERYONE
        io.emit("price_update", station); 
    }
  });
});

// --- API ROUTES ---

// 1. GET ALL STATIONS
app.get('/api/stations', async (req, res) => {
  const stations = await Station.find();
  res.json(stations);
});

// 2. ADD A NEW STATION (HOST)
app.post('/api/stations', async (req, res) => {
  const newStation = new Station({ ...req.body, currentPrice: req.body.basePrice });
  await newStation.save();
  io.emit("global_update", newStation); // Tell frontends a new pin dropped
  res.json(newStation);
});

// 3. LOGIN / SIGNUP (Simplified)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) res.json(user);
  else res.status(400).json({ error: "User not found" });
});

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  const user = new User({ username, password, walletBalance: 1000 }); // Free ₹1000 on signup
  await user.save();
  res.json(user);
});

// 4. RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
    const { username, newPassword } = req.body;
    const user = await User.findOneAndUpdate({ username }, { password: newPassword });
    if(user) res.json({ success: true });
    else res.status(404).json({ error: "User not found" });
});

// 5. BOOK A STATION (With Vehicle Type & Wallet Logic)
app.post('/api/bookings', async (req, res) => {
  try {
    const { stationName, price, paymentMethod, username, vehicleType } = req.body;
    
    // Deduct from Wallet if that method is chosen
    if (paymentMethod === "Grid-Lock Wallet") {
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
    res.status(500).json({ error: "Booking Failed" });
  }
});

// 6. GET USER WALLET
app.get('/api/wallet/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.json({ balance: user ? user.walletBalance : 0 });
});

// 7. ADD MONEY TO WALLET
app.post('/api/wallet/add', async (req, res) => {
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
});

// 8. GET TRANSACTIONS
app.get('/api/transactions/:username', async (req, res) => {
    const history = await Transaction.find({ username: req.params.username }).sort({ date: -1 });
    res.json(history);
});

// 9. ADD REVIEW
app.post('/api/stations/:id/reviews', async (req, res) => {
    const { user, rating, comment } = req.body;
    const station = await Station.findById(req.params.id);
    if(station) {
        station.reviews.push({ user, rating, comment });
        await station.save();
        res.json(station);
    } else {
        res.status(404).json({ error: "Station not found" });
    }
});

server.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});
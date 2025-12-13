const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from any frontend (Vercel)
        methods: ["GET", "POST"]
    }
});

// --- DATABASE CONNECTION ---
// Replace this string with your actual MongoDB connection string if it's different
// or use process.env.MONGO_URI if you set it up in Render
const MONGO_URI = "mongodb+srv://gridlock_user:gridlock123@cluster0.mongodb.net/gridlock?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- SCHEMAS ---
const StationSchema = new mongoose.Schema({
    name: String,
    basePrice: Number,
    currentPrice: Number,
    location: { lat: Number, lng: Number },
    status: String, // "Available", "Busy", "Closed"
    hostPhone: String,
    address: String,
    reviews: [{ user: String, rating: Number, comment: String }]
});
const Station = mongoose.model('Station', StationSchema);

const UserSchema = new mongoose.Schema({
    username: String,
    password: String, // In production, hash this!
    walletBalance: { type: Number, default: 2000 }
});
const User = mongoose.model('User', UserSchema);

const BookingSchema = new mongoose.Schema({
    stationName: String,
    pricePaid: Number,
    date: { type: Date, default: Date.now },
    username: String,
    vehicleType: String
});
const Booking = mongoose.model('Booking', BookingSchema);

const TransactionSchema = new mongoose.Schema({
    username: String,
    amount: Number,
    type: String, // "CREDIT" or "DEBIT"
    description: String,
    date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', TransactionSchema);

// --- API ROUTES ---

// 1. Get All Stations
app.get('/api/stations', async (req, res) => {
    const stations = await Station.find();
    res.json(stations);
});

// 2. Auth: Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
        res.json(user);
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// 3. Auth: Signup
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "User exists" });
    
    const newUser = new User({ username, password });
    await newUser.save();
    res.json(newUser);
});

// 4. Create Booking
app.post('/api/bookings', async (req, res) => {
    const { stationName, price, username, vehicleType } = req.body;
    
    // Deduct from Wallet
    const user = await User.findOne({ username });
    if (user.walletBalance < price) {
        return res.status(400).json({ error: "Insufficient Funds" });
    }
    user.walletBalance -= price;
    await user.save();

    // Create Booking Record
    const newBooking = new Booking({ stationName, pricePaid: price, username, vehicleType });
    await newBooking.save();

    // Log Transaction
    await Transaction.create({
        username,
        amount: price,
        type: 'DEBIT',
        description: `Charge at ${stationName}`
    });

    res.json(newBooking);
});

// 5. Get User Bookings
app.get('/api/bookings', async (req, res) => {
    const bookings = await Booking.find().sort({ date: -1 });
    res.json(bookings);
});

// 6. Get Wallet Balance
app.get('/api/wallet/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.json({ balance: user ? user.walletBalance : 0 });
});

// 7. Add Funds
app.post('/api/wallet/add', async (req, res) => {
    const { username, amount } = req.body;
    const user = await User.findOne({ username });
    if(user) {
        user.walletBalance += amount;
        await user.save();
        await Transaction.create({
            username,
            amount,
            type: 'CREDIT',
            description: "Wallet Top-up"
        });
        res.json({ balance: user.walletBalance });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

// 8. Get Transactions
app.get('/api/transactions/:username', async (req, res) => {
    const txs = await Transaction.find({ username: req.params.username }).sort({ date: -1 });
    res.json(txs);
});

// 9. Add Station (Host)
app.post('/api/stations', async (req, res) => {
    const newStation = new Station(req.body);
    await newStation.save();
    // Broadcast new station to everyone on the map
    io.emit("global_update", newStation); 
    res.json(newStation);
});

// --- SOCKET.IO LOGIC (The "Brain") ---
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // A. Handle Price Bidding
    socket.on("place_bid", async (data) => {
        const { stationId, amount } = data;
        const station = await Station.findById(stationId);
        if(station) {
            station.currentPrice = amount;
            await station.save();
            io.emit("price_update", station); 
        }
    });

    // B. Handle Python Simulation Data
    socket.on("sim_update", (data) => {
        console.log("🔥 Python Data Received:", data);
        // Relay to React Frontend
        io.emit("live_analytics", data);
    });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
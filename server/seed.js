const mongoose = require('mongoose');
const Station = require('./models/Station');

// REPLACE WITH YOUR MONGO URI
const MONGO_URI = 'mongodb+srv://admin:password1234@admin.qv5es5r.mongodb.net/?appName=admin'; 

mongoose.connect(MONGO_URI)
.then(async () => {
    console.log("✅ Connected! Updating Station Status...");
    
    await Station.deleteMany({});

    const stations = [
      { 
        name: "Connaught Place Fast Charger", 
        address: "Block A, CP, New Delhi",
        hostPhone: "+919810098100", // Real format for dialer
        status: "Open", // NEW FIELD
        location: { lat: 28.6315, lng: 77.2167 },
        basePrice: 250, currentPrice: 250, isAuctioning: false, reviews: [], bids: []
      },
      { 
        name: "Indiranagar Home Spot", 
        address: "100ft Road, Bangalore",
        hostPhone: "+919980199801",
        status: "Open",
        location: { lat: 12.9716, lng: 77.5946 },
        basePrice: 150, currentPrice: 150, isAuctioning: false, reviews: [], bids: []
      },
      { 
        name: "Bandra Kurla Complex Hub", 
        address: "BKC, Mumbai",
        hostPhone: "+919123456789",
        status: "Busy", // NEW STATUS
        location: { lat: 19.0760, lng: 72.8777 },
        basePrice: 400, currentPrice: 450, isAuctioning: true, reviews: [], bids: []
      },
      { 
        name: "Hitech City EV Point", 
        address: "Cyber Towers, Hyderabad",
        hostPhone: "+919000011222",
        status: "Closed", // THIS ONE IS CLOSED
        location: { lat: 17.4435, lng: 78.3772 },
        basePrice: 300, currentPrice: 300, isAuctioning: false, reviews: [], bids: []
      },
      { 
        name: "Marina Beach Charger", 
        address: "Kamarajar Salai, Chennai",
        hostPhone: "+919444455555",
        status: "Open",
        location: { lat: 13.0475, lng: 80.2824 },
        basePrice: 200, currentPrice: 200, isAuctioning: false, reviews: [], bids: []
      }
    ];

    await Station.insertMany(stations);
    console.log("✅ Stations updated with Status & Contacts!");
    process.exit();
})
.catch(err => { console.log("❌ Error:", err.message); });
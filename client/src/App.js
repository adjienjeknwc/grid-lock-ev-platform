import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import io from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Zap, Wallet, MapPin, PlusCircle, X, History, FileText, CheckCircle, 
  CreditCard, Star, BatteryCharging, TrendingUp, Clock, ArrowUpRight, 
  ArrowDownLeft, Plus, LogOut, Phone, MessageSquare, Send, User, Car, 
  Bike, Map as MapIcon, Settings, Navigation, Crosshair, Menu, ChevronUp, ChevronDown, 
  Smartphone, AlertCircle, PhoneCall, Key, ThumbsUp, Home, Search, QrCode
} from 'lucide-react';

// --- ICONS SETUP ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import logo from './logo.png'; 

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const socket = io.connect("https://grid-lock-api.onrender.com");

// --- HELPER: MOVE MAP ---
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 13); }, [center, map]);
  return null;
}

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('gridlock_user')); } catch (e) { return null; } });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  // App Data
  const [stations, setStations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [activeStation, setActiveStation] = useState(null);
  const [currentView, setCurrentView] = useState("home"); 
  const [userLocation, setUserLocation] = useState(null); 
  const [userAddress, setUserAddress] = useState("Tap GPS to detect");
  const [nearestStations, setNearestStations] = useState([]); 
  
  // NEW: Analytics State for Python Simulation
  const [analytics, setAnalytics] = useState(null);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPaymentGateway, setShowPaymentGateway] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [showChargingScreen, setShowChargingScreen] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Forms
  const [paymentMethod, setPaymentMethod] = useState("card"); 
  const [vehicleType, setVehicleType] = useState("Car");
  const [processing, setProcessing] = useState(false);
  const [chargingProgress, setChargingProgress] = useState(0);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [lastBookedStation, setLastBookedStation] = useState(null);
  
  // UPDATED FORM DATA STATE
  const [formData, setFormData] = useState({ 
      name: '', price: '', address: '', phone: '', 
      hostName: '', adharId: '', timings: '' 
  });
  const [addAmount, setAddAmount] = useState(500);
  const [chatMessage, setChatMessage] = useState("");
  const [newPasswordForm, setNewPasswordForm] = useState("");

  // Initial Data Fetch & Socket Listeners
  useEffect(() => {
    if (user) {
        localStorage.setItem('gridlock_user', JSON.stringify(user));
        
        // Fetch Initial Data
        fetch('https://grid-lock-api.onrender.com').then(res => res.json()).then(setStations);
        fetch('https://grid-lock-api.onrender.com').then(res => res.json()).then(setBookings);
        fetch(`https://grid-lock-api.onrender.com/api/wallet/${user.username}`).then(res => res.json()).then(data => setBalance(data.balance));
        fetch(`https://grid-lock-api.onrender.com/api/transactions/${user.username}`).then(res => res.json()).then(setTransactions);
        
        // Socket Listeners
        socket.on("price_update", (updated) => setStations(prev => prev.map(s => s._id === updated._id ? updated : s)));
        socket.on("global_update", (newStation) => setStations(prev => [...prev, newStation]));
        
        // NEW: Listen for Python Simulation Data
        // NEW: Listen for Python Simulation Data
socket.on("live_analytics", (data) => {
    console.log("🔥 DATA RECEIVED FROM PYTHON:", data); // <--- Add this
    setAnalytics(data);
});

        
    } else { 
        localStorage.removeItem('gridlock_user'); 
    }
  }, [user]);

  // Logic Helpers
  const handleLocateMe = () => {
    if (!navigator.geolocation) { alert("Geolocation is not supported by this browser."); return; }
    
    setUserAddress("Detecting...");
    
    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        
        const withDist = stations.map(s => ({ ...s, distance: getDistance(latitude, longitude, s.location.lat, s.location.lng) }));
        setNearestStations(withDist.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 3));
        
        setMobileMenuOpen(true);
    }, (error) => {
        console.error("GPS Error: ", error);
        let errorMsg = "Unable to retrieve location.";
        if (error.code === 1) errorMsg = "Permission Denied! Please allow location access in your browser settings.";
        else if (error.code === 2) errorMsg = "Position Unavailable. Please check your GPS.";
        else if (error.code === 3) errorMsg = "Request Timed Out. Please try again.";
        
        setUserAddress("Location Failed");
        alert(errorMsg);
    }, options);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; 
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
      return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
  };

  const getUserStats = () => {
      if (!user) return { totalTrips: 0, totalSpent: 0, carTrips: 0, bikeTrips: 0 };
      const myBookings = bookings.filter(b => b.username === user.username);
      return { 
          totalTrips: myBookings.length, 
          totalSpent: myBookings.reduce((acc, b) => acc + b.pricePaid, 0),
          carTrips: myBookings.filter(b => b.vehicleType === "Car").length,
          bikeTrips: myBookings.filter(b => b.vehicleType === "Bike").length
      };
  };

  const getAverageRating = (station) => {
    if (!station.reviews || station.reviews.length === 0) return "New";
    const total = station.reviews.reduce((acc, r) => acc + r.rating, 0);
    return (total / station.reviews.length).toFixed(1);
  };

  const getStatusColor = (status) => {
      if(status === 'Closed') return 'bg-red-100 text-red-600';
      if(status === 'Busy') return 'bg-orange-100 text-orange-600';
      return 'bg-green-100 text-green-600';
  };

  // Auth & Payments
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`https://grid-lock-api.onrender.com${authMode === 'login' ? '/api/login' : '/api/signup'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
        const data = await res.json();
        if (res.ok) setUser(data); else alert(data.error);
    } catch (e) { alert("Server Error"); }
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem('gridlock_user'); };

  const handleChangePasswordLoggedIn = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('https://grid-lock-api.onrender.com/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, newPassword: newPasswordForm }) });
        if(res.ok) { alert("Password updated!"); setShowSettingsModal(false); setNewPasswordForm(""); } else { alert("Failed to update"); }
    } catch(err) { alert("Server Error"); }
  };

  const processPayment = async () => {
    setProcessing(true);
    setTimeout(async () => {
        const res = await fetch('https://grid-lock-api.onrender.com/api/bookings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationName: activeStation.name, price: activeStation.currentPrice, paymentMethod: paymentMethod === 'upi' ? "GPay/UPI" : "Card", username: user.username, vehicleType })
        });
        if (res.ok) {
            const newBooking = await res.json();
            setBookings([newBooking, ...bookings]);
            if (paymentMethod === 'wallet') {
                const wRes = await fetch(`https://grid-lock-api.onrender.com/api/wallet/${user.username}`);
                const wData = await wRes.json();
                setBalance(wData.balance);
            }
            fetch(`https://grid-lock-api.onrender.com/api/transactions/${user.username}`).then(res => res.json()).then(setTransactions);
            setProcessing(false); setShowPaymentGateway(false); setLastBookedStation(activeStation); setActiveStation(null); startChargingSimulation(); 
        } else { alert("Payment Failed!"); setProcessing(false); }
    }, 1500);
  };

  const startChargingSimulation = () => {
    setShowChargingScreen(true); setChargingProgress(0);
    let p = 0;
    const int = setInterval(() => { p += 5; setChargingProgress(p); if (p >= 100) { clearInterval(int); setTimeout(() => { setShowChargingScreen(false); setShowReviewModal(true); }, 1000); } }, 150);
  };

  const handleSubmitReview = async () => {
    if(!lastBookedStation) return;
    await fetch(`https://grid-lock-api.onrender.com/api/stations/${lastBookedStation._id}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: user.username, rating: reviewForm.rating, comment: reviewForm.comment }) });
    setShowReviewModal(false); setActiveInvoice(bookings[0]); 
  };

  const handleAddFunds = async () => {
    setProcessing(true);
    setTimeout(async () => {
        const res = await fetch('hhttps://grid-lock-api.onrender.com/api/wallet/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, amount: addAmount }) });
        const data = await res.json();
        setBalance(data.balance);
        fetch(`https://grid-lock-api.onrender.com/api/transactions/${user.username}`).then(res => res.json()).then(setTransactions);
        setProcessing(false); setShowAddFundsModal(false); alert(`Added ₹${addAmount} via ${paymentMethod === 'upi' ? 'GPay' : 'Card'}!`);
    }, 2000);
  };

  const handleSendMessage = () => { setChatMessage(""); };

  const handleAddStation = async (e) => {
    e.preventDefault();
    const newStation = {
      name: formData.name, 
      hostName: formData.hostName,
      adharId: formData.adharId,
      timings: formData.timings,
      basePrice: Number(formData.price), 
      address: formData.address, 
      hostPhone: formData.phone,
      lat: userLocation ? userLocation.lat : 28.6315, 
      lng: userLocation ? userLocation.lng : 77.2167 
    };
    await fetch('https://grid-lock-api.onrender.com/api/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newStation) });
    setShowHostModal(false); 
    setFormData({ name: '', price: '', address: '', phone: '', hostName: '', adharId: '', timings: '' }); 
    alert("Station Deployed Successfully!");
  };

  // --- Login/Signup Screen Render Logic ---
  if (!user) {
      return (
          <div className="h-screen w-full flex justify-center items-center bg-gray-900 text-gray-800 p-4">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-in zoom-in text-center">
                  
                  {/* LOGO */}
                  <div className="flex justify-center mb-6"><img src={logo} alt="Grid-Lock Logo" className="h-28 object-contain drop-shadow-lg" /></div>
                  
                  <h2 className="text-2xl font-black mb-6">
                      {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
                  </h2>
                  
                  <form onSubmit={handleAuth} className="space-y-4 text-left">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Username</label>
                        <input required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-black outline-none font-bold" placeholder="e.g. Aditi_EV" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
                        <input type="password" required className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-black outline-none font-bold" placeholder="••••••" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                      </div>

                      <button type="submit" className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-transform active:scale-95 text-lg">
                          {authMode === 'login' ? 'Login' : 'Sign Up'}
                      </button>
                  </form>

                  <button 
                    type="button" 
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
                    className="w-full mt-6 text-sm text-gray-500 font-bold hover:text-black transition-colors"
                  >
                      {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                  </button>
              </div>
          </div>
      );
  }

  const stats = getUserStats();

  return (
    <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-gray-100 font-sans">
      
      {/* 1. MAP BACKGROUND */}
      <div className="absolute inset-0 md:relative md:flex-1 md:order-2 z-0">
        <MapContainer center={[28.6315, 77.2167]} zoom={5} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
          <MapUpdater center={userLocation} />
          {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}><div/></Marker>}
          {stations.map((s) => <Marker key={s._id} position={[s.location.lat, s.location.lng]} icon={s.isAuctioning ? redIcon : DefaultIcon} eventHandlers={{ click: () => { setActiveStation(s); setCurrentView('map'); setMobileMenuOpen(false); } }} />)}
        </MapContainer>
        <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-center md:hidden pointer-events-none">
            <div className="bg-white/90 backdrop-blur p-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">{user.username[0].toUpperCase()}</div>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="bg-white/90 p-2 rounded-full shadow-lg pointer-events-auto text-black"><Menu /></button>
        </div>
      </div>

      {/* 2. SIDEBAR / HOME UI */}
      <div className={`absolute bottom-0 left-0 right-0 md:relative md:w-[450px] md:h-full md:order-1 bg-white md:bg-gray-900 shadow-2xl z-[2000] flex flex-col rounded-t-3xl md:rounded-none transition-all duration-300 ${mobileMenuOpen || currentView === 'home' ? 'h-[85vh]' : 'h-[40vh]'} md:h-full`}>
        <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><div className="w-12 h-1.5 bg-gray-300 rounded-full"></div></div>
        
        {/* Header */}
        <div className="hidden md:flex p-6 border-b border-gray-800 justify-between items-center text-white">
            <div className="flex items-center gap-3"><img src={logo} alt="Logo" className="w-10 h-10 object-contain" /><h1 className="text-2xl font-bold text-yellow-400">Grid-Lock</h1></div>
            <div className="flex gap-2"><button onClick={()=>setShowSettingsModal(true)} title="Settings"><Settings size={18} className="text-gray-400 hover:text-white"/></button><button onClick={handleLogout} title="Logout"><LogOut size={18} className="text-gray-400 hover:text-white"/></button></div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-2 border-b md:border-gray-800 md:bg-gray-900">
            {['home', 'map', 'nearest', 'history'].map(view => (
                <button key={view} onClick={() => { setCurrentView(view); setMobileMenuOpen(true); }} className={`flex-1 py-2 text-xs font-bold capitalize rounded-lg ${currentView === view ? 'bg-yellow-400 text-black' : 'text-gray-400 hover:text-white'}`}>
                    {view === 'home' ? <Home size={16} className="mx-auto"/> : view}
                </button>
            ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 md:bg-gray-900">
            
            {/* --- HOME VIEW --- */}
            {currentView === 'home' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-5">
                    
                    {/* NEW: LIVE SYSTEM MONITOR (Only shows when Python script is running) */}
                    {analytics && (
                        <div className="mb-6 p-4 bg-black rounded-2xl text-white shadow-xl border border-gray-800 animate-pulse">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                    DEGS-Node Live Stream
                                </h3>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${analytics.status === 'CRITICAL' ? 'bg-red-600' : 'bg-green-600'}`}>
                                    {analytics.status}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-gray-900 rounded-lg">
                                    <p className="text-[10px] text-gray-400 uppercase">Transformer</p>
                                    <p className={`text-xl font-bold ${analytics.temp_actual > 80 ? 'text-red-500' : 'text-white'}`}>
                                        {analytics.temp_actual}°C
                                    </p>
                                </div>
                                <div className="p-2 bg-gray-900 rounded-lg">
                                    <p className="text-[10px] text-gray-400 uppercase">Prediction</p>
                                    <p className="text-xl font-bold text-blue-400">
                                        {analytics.temp_predicted}°C
                                    </p>
                                </div>
                                <div className="p-2 bg-gray-900 rounded-lg">
                                    <p className="text-[10px] text-gray-400 uppercase">Load Shaping</p>
                                    <p className="text-xl font-bold text-purple-400">
                                        {(analytics.alpha * 100).toFixed(0)}%
                                    </p>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 text-center">
                                Algo: APTS-Predictive v1.0 • Latency: 24ms
                            </p>
                        </div>
                    )}

                    {/* Welcome Card */}
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 md:from-blue-600 md:to-purple-600 p-5 rounded-2xl text-white shadow-lg">
                        <div className="flex justify-between items-start">
                            <div><p className="text-xs opacity-70 mb-1">Good Morning,</p><h2 className="text-2xl font-bold">{user.username}</h2></div>
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">{user.username[0].toUpperCase()}</div>
                        </div>
                        <div className="mt-6 flex justify-between items-end">
                            <div><p className="text-xs opacity-70">Wallet Balance</p><p className="text-3xl font-black mt-1">₹{balance.toFixed(2)}</p></div>
                            <button onClick={()=>setShowAddFundsModal(true)} className="bg-white text-black p-2 rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-gray-100"><PlusCircle size={14}/> Top Up</button>
                        </div>
                    </div>

                    {/* LOCATION CARD */}
                    <div className="bg-white md:bg-gray-800 p-4 rounded-xl shadow-sm border md:border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 md:bg-blue-900 rounded-full text-blue-600 md:text-blue-300"><MapIcon size={20}/></div>
                            <div>
                                <p className="text-xs text-gray-500 md:text-gray-400 font-bold uppercase">Current Location</p>
                                <p className="text-sm font-bold text-gray-800 md:text-white truncate w-40 md:w-48">{userAddress}</p>
                            </div>
                        </div>
                        <button onClick={handleLocateMe} className="p-2 bg-gray-100 md:bg-gray-700 rounded-full hover:bg-gray-200 md:hover:bg-gray-600 transition-colors" title="Locate Me">
                            <Crosshair size={20} className="text-black md:text-white"/>
                        </button>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={()=>{setCurrentView('map')}} className="flex flex-col items-center gap-2 p-3 bg-white md:bg-gray-800 rounded-xl shadow-sm hover:bg-gray-50 md:hover:bg-gray-700 transition-colors"><div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Search size={20}/></div><span className="text-[10px] font-bold md:text-gray-300">Find</span></button>
                        <button onClick={()=>{setCurrentView('nearest')}} className="flex flex-col items-center gap-2 p-3 bg-white md:bg-gray-800 rounded-xl shadow-sm hover:bg-gray-50 md:hover:bg-gray-700 transition-colors"><div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><Navigation size={20}/></div><span className="text-[10px] font-bold md:text-gray-300">Near Me</span></button>
                        <button onClick={()=>{/*QR Logic*/ alert("Camera opening...")}} className="flex flex-col items-center gap-2 p-3 bg-white md:bg-gray-800 rounded-xl shadow-sm hover:bg-gray-50 md:hover:bg-gray-700 transition-colors"><div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><QrCode size={20}/></div><span className="text-[10px] font-bold md:text-gray-300">Scan</span></button>
                        <button onClick={()=>setShowProfileModal(true)} className="flex flex-col items-center gap-2 p-3 bg-white md:bg-gray-800 rounded-xl shadow-sm hover:bg-gray-50 md:hover:bg-gray-700 transition-colors"><div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center"><User size={20}/></div><span className="text-[10px] font-bold md:text-gray-300">Profile</span></button>
                    </div>

                    {/* Promo Banner */}
                    <div onClick={()=>setShowHostModal(true)} className="bg-yellow-400 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-yellow-500 transition-colors shadow-sm">
                        <div><h3 className="font-bold text-black text-sm">Become a Host</h3><p className="text-xs text-black/70">Earn passive income today!</p></div>
                        <div className="bg-white p-2 rounded-full"><Zap className="text-yellow-600" size={20}/></div>
                    </div>

                    {/* Nearby List Preview */}
                    <div>
                        <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-sm md:text-white">Popular Near You</h3><button onClick={()=>setCurrentView('nearest')} className="text-blue-600 text-xs font-bold">See All</button></div>
                        <div className="space-y-2">
                            {stations.slice(0,2).map(s => (
                                <div key={s._id} onClick={() => { setActiveStation(s); setCurrentView('map'); }} className="flex items-center gap-3 p-3 bg-white md:bg-gray-800 rounded-xl shadow-sm cursor-pointer border md:border-gray-700">
                                    <div className="w-10 h-10 bg-gray-100 md:bg-gray-700 rounded-lg flex items-center justify-center"><Zap size={18} className="text-gray-500 md:text-yellow-400"/></div>
                                    <div className="flex-1"><h4 className="font-bold text-xs md:text-white">{s.name}</h4><p className="text-[10px] text-gray-500 md:text-gray-400">{s.address ? s.address.substring(0, 20) : "Location"}...</p></div>
                                    <span className="text-xs font-bold text-green-600 md:text-green-400 bg-green-50 md:bg-green-900/30 px-2 py-1 rounded">₹{s.currentPrice}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {currentView === 'map' && stations.map(s => (
                <div key={s._id} onClick={() => setActiveStation(s)} className="p-4 bg-white md:bg-gray-800 rounded-xl shadow-sm md:border md:border-gray-700 cursor-pointer">
                    <div className="flex justify-between items-center">
                        <div><span className="font-bold text-sm md:text-white block">{s.name}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getStatusColor(s.status || 'Open')}`}>{s.status || "Open"}</span></div>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">₹{s.currentPrice}</span>
                    </div>
                </div>
            ))}
            
            {currentView === 'nearest' && nearestStations.map(s => (
                <div key={s._id} onClick={() => setActiveStation(s)} className="p-4 bg-white md:bg-gray-800 border-l-4 border-green-500 rounded-r-xl shadow-sm cursor-pointer">
                    <div className="flex justify-between mb-1"><span className="font-bold text-sm md:text-white">{s.name}</span><span className="text-green-600 font-bold">₹{s.currentPrice}</span></div>
                    <div className="flex justify-between items-center text-xs text-gray-500"><span className="flex items-center gap-1"><Navigation size={12}/> {s.distance} km</span><span className={`font-bold ${getStatusColor(s.status)}`}>{s.status}</span></div>
                </div>
            ))}

            {currentView === 'history' && (
                transactions.length === 0 ? <div className="text-center p-8 text-gray-400"><AlertCircle className="mx-auto mb-2 opacity-50"/><p className="text-xs">No transactions.</p></div> :
                transactions.map(t => (
                    <div key={t._id} onClick={() => { setActiveStation(t.stationName); setCurrentView('map'); }} className="p-3 bg-white md:bg-gray-800 rounded-lg shadow-sm border border-gray-100 md:border-gray-700 flex justify-between items-center cursor-pointer">
                        <div className="flex items-center gap-3"><div className={`p-2 rounded-full ${t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{t.type === 'CREDIT' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</div><div><p className="text-xs font-bold md:text-white">{t.description}</p><p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString()}</p></div></div>
                        <span className={`font-mono font-bold text-sm ${t.type === 'CREDIT' ? 'text-green-600' : 'text-gray-800 md:text-white'}`}>{t.type === 'CREDIT' ? '+' : '-'}₹{t.amount}</span>
                    </div>
                ))
            )}
        </div>
        
        <div className="p-4 border-t bg-white md:bg-gray-800 md:border-gray-700 flex items-center gap-3 pb-8 md:pb-4">
            <div className="p-2 bg-blue-600 rounded-full text-white"><Wallet size={20}/></div>
            <div className="flex-1"><p className="text-xs text-gray-500 md:text-gray-400">Balance</p><p className="text-lg font-mono font-bold md:text-white">₹{balance.toFixed(2)}</p></div>
            <button onClick={() => setShowAddFundsModal(true)} className="p-3 bg-gray-100 md:bg-gray-700 rounded-full text-blue-600 md:text-blue-400"><Plus size={20} /></button>
        </div>
      </div>

      {/* --- MODALS --- */}
      {activeStation && !showPaymentGateway && (
          <div className="fixed md:absolute bottom-0 md:top-6 md:bottom-auto left-0 right-0 md:left-auto md:right-6 md:w-80 bg-white p-6 rounded-t-3xl md:rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-[3000] animate-in slide-in-from-bottom-10 md:fade-in">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 md:hidden"></div>
            <div className="flex justify-between mb-1"><h2 className="text-xl font-bold">{activeStation.name}</h2><button onClick={() => setActiveStation(null)} className="p-1 bg-gray-100 rounded-full"><X size={18}/></button></div>
            <div className="flex items-center gap-2 mb-4"><span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(activeStation.status || 'Open')}`}>{activeStation.status || 'Open'}</span><span className="flex items-center gap-1 text-xs text-yellow-600 font-bold"><Star size={12}/> 4.8</span></div>
            <div className="grid grid-cols-2 gap-2 mb-4"><a href={`tel:${activeStation.hostPhone}`} className="flex items-center justify-center gap-2 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-200"><PhoneCall size={14}/> Call Host</a><button onClick={() => setShowChatModal(true)} className="flex items-center justify-center gap-2 py-2 bg-gray-100 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-200"><MessageSquare size={14}/> Message</button></div>
            <div className="text-center py-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 mb-4"><p className="text-xs font-bold uppercase text-gray-400">Hourly Rate</p><p className="text-3xl font-black text-gray-900">₹{activeStation.currentPrice}</p></div>
            <div className="flex gap-2"><a href={`http://maps.google.com/?q=${activeStation.location.lat},${activeStation.location.lng}`} target="_blank" rel="noreferrer" className="flex-1 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100"><Navigation size={18}/> Route</a><button onClick={() => setShowPaymentGateway(true)} disabled={activeStation.status === 'Closed'} className={`flex-[2] py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors ${activeStation.status === 'Closed' ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}><CheckCircle size={18} /> {activeStation.status === 'Closed' ? 'Closed' : 'Book Now'}</button></div>
          </div>
      )}

      {showChatModal && <div className="fixed md:absolute bottom-0 md:top-6 md:right-96 left-0 right-0 md:left-auto md:w-80 bg-white md:rounded-xl shadow-2xl z-[4000] border overflow-hidden flex flex-col h-[50vh] md:h-96 rounded-t-3xl animate-in slide-in-from-bottom-10"><div className="bg-blue-600 p-4 text-white flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><User size={16}/></div><div><p className="font-bold text-sm">Station Host</p><p className="text-[10px] opacity-80">Online</p></div></div><button onClick={() => setShowChatModal(false)}><X size={18}/></button></div><div className="flex-1 bg-gray-50 p-3 overflow-y-auto"><div className="flex justify-start mb-2"><div className="bg-white p-2 rounded-lg rounded-tl-none text-sm shadow-sm border max-w-[80%]">Hello! Is the charger available?</div></div><div className="flex justify-end mb-2"><div className="bg-blue-600 text-white p-2 rounded-lg rounded-tr-none text-sm shadow-sm max-w-[80%]">Yes, it is open and ready!</div></div></div><div className="p-3 border-t bg-white flex gap-2"><input className="flex-1 text-sm p-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Type a message..." value={chatMessage} onChange={e=>setChatMessage(e.target.value)}/><button onClick={handleSendMessage} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"><Send size={16}/></button></div></div>}
      {showPaymentGateway && activeStation && <div className="fixed inset-0 bg-black/60 z-[4000] flex justify-center items-end md:items-center p-4 backdrop-blur-sm"><div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 animate-in slide-in-from-bottom-10"><h2 className="text-xl font-bold mb-4">Pay ₹{activeStation.currentPrice}</h2><div className="flex gap-2 mb-4"><button onClick={()=>setPaymentMethod('card')} className="flex-1 p-3 border rounded text-sm font-bold">Card</button><button onClick={()=>setPaymentMethod('upi')} className="flex-1 p-3 border rounded text-sm font-bold">GPay/UPI</button></div><button onClick={processPayment} disabled={processing} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl">{processing?"Processing...":"Pay Now"}</button><button onClick={()=>setShowPaymentGateway(false)} className="w-full mt-2 text-sm text-gray-500">Cancel</button></div></div>}
      {showAddFundsModal && <div className="fixed inset-0 bg-black/60 z-[5000] flex justify-center items-center p-4"><div className="bg-white w-full max-w-sm rounded-2xl p-6"><h2 className="font-bold mb-4">Add Money</h2><input type="number" value={addAmount} onChange={e=>setAddAmount(Number(e.target.value))} className="w-full p-2 border mb-4"/><button onClick={handleAddFunds} disabled={processing} className="w-full py-3 bg-blue-600 text-white font-bold rounded">{processing?"Processing...":"Pay"}</button><button onClick={()=>setShowAddFundsModal(false)} className="w-full mt-2 text-sm">Cancel</button></div></div>}
      {showChargingScreen && <div className="fixed inset-0 bg-black/95 z-[6000] flex flex-col justify-center items-center text-white"><BatteryCharging size={120} className={chargingProgress<100?"animate-pulse text-yellow-400":"text-green-500"}/><h2 className="text-3xl font-bold mt-4">{chargingProgress}% Charged</h2></div>}
      {showReviewModal && <div className="fixed inset-0 bg-black/60 z-[6000] flex justify-center items-center p-4"><div className="bg-white p-6 rounded-2xl text-center"><Star size={40} className="text-yellow-400 mx-auto mb-4"/><button onClick={handleSubmitReview} className="w-full py-3 bg-black text-white font-bold rounded">Submit Review</button></div></div>}
      {showProfileModal && <div className="fixed inset-0 bg-black/60 z-[5000] flex justify-center items-center p-4"><div className="bg-white w-full max-w-md rounded-2xl p-6"><div className="flex justify-between mb-4"><h2 className="font-bold text-xl">Profile</h2><button onClick={()=>setShowProfileModal(false)}><X/></button></div><div className="p-6"><div className="flex justify-between items-start mb-4"><div className="flex items-center gap-4"><div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-white">{user.username[0].toUpperCase()}</div><div><h2 className="text-2xl font-bold">{user.username}</h2><p className="text-gray-400 text-xs flex items-center gap-1"><User size={12}/> ID: {user._id || "883920"}</p></div></div></div><button onClick={() => { setShowProfileModal(false); setShowSettingsModal(true); }} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-200 border border-gray-300 mb-6"><Key size={12}/> Change Password</button><div className="grid grid-cols-2 gap-3 mb-6"><div className="p-4 bg-blue-50 rounded-xl text-center"><p className="text-xl font-black text-blue-600">₹{balance}</p><p className="text-[10px] uppercase font-bold text-gray-500">Wallet</p></div><div className="p-4 bg-green-50 rounded-xl text-center"><p className="text-xl font-black text-green-600">₹{stats.totalSpent}</p><p className="text-[10px] uppercase font-bold text-gray-500">Spent</p></div><div className="p-4 bg-purple-50 rounded-xl text-center"><p className="text-xl font-black text-purple-600">{stats.totalTrips}</p><p className="text-[10px] uppercase font-bold text-gray-500">Trips</p></div><div className="p-4 bg-yellow-50 rounded-xl text-center"><p className="text-xl font-black text-yellow-600 flex justify-center items-center gap-1">4.9 <Star size={14} fill="currentColor"/></p><p className="text-[10px] uppercase font-bold text-gray-500">Guest Rating</p></div></div><h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-700"><ThumbsUp size={16}/> What Hosts Say</h3><div className="space-y-3"><div className="p-3 bg-gray-50 rounded-lg border border-gray-100"><div className="flex justify-between items-center mb-1"><span className="font-bold text-xs">Indiranagar Station</span><div className="flex text-yellow-400"><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/></div></div><p className="text-xs text-gray-500 italic">"Very polite user, unplugged on time!"</p></div><div className="p-3 bg-gray-50 rounded-lg border border-gray-100"><div className="flex justify-between items-center mb-1"><span className="font-bold text-xs">Marina Beach Hub</span><div className="flex text-yellow-400"><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/><Star size={10} fill="currentColor"/></div></div><p className="text-xs text-gray-500 italic">"Great guest. Highly recommended."</p></div></div></div></div></div>}
      {showSettingsModal && <div className="fixed inset-0 bg-black/60 z-[5000] flex justify-center items-center p-4"><div className="bg-white w-full max-w-sm rounded-2xl p-6"><h2 className="text-xl font-bold mb-4">Settings</h2><input type="password" placeholder="New Password" className="w-full p-3 border rounded-lg mb-4" onChange={e=>setNewPasswordForm(e.target.value)}/><button onClick={handleChangePasswordLoggedIn} className="w-full py-3 bg-red-600 text-white font-bold rounded-lg mb-2">Update Password</button><button onClick={()=>setShowSettingsModal(false)} className="w-full py-3 text-gray-500 font-bold">Close</button></div></div>}
      {showHostModal && <div className="fixed inset-0 bg-black/80 z-[2000] flex justify-center items-center p-4"><div className="bg-white w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"><h2 className="text-2xl font-bold mb-4">Add Station</h2><form onSubmit={handleAddStation} className="space-y-3"><input required className="w-full p-3 border rounded-lg" placeholder="Station Name" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})}/><input required className="w-full p-3 border rounded-lg" placeholder="Host Name" value={formData.hostName} onChange={e=>setFormData({...formData, hostName:e.target.value})}/><input required className="w-full p-3 border rounded-lg" placeholder="Aadhar ID" value={formData.adharId} onChange={e=>setFormData({...formData, adharId:e.target.value})}/><input required className="w-full p-3 border rounded-lg" placeholder="Station Address" value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})}/><div className="flex gap-2"><input required className="w-1/2 p-3 border rounded-lg" placeholder="Phone" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})}/><input required className="w-1/2 p-3 border rounded-lg" placeholder="Time (9am-9pm)" value={formData.timings} onChange={e=>setFormData({...formData, timings:e.target.value})}/></div><input required type="number" className="w-full p-3 border rounded-lg" placeholder="Price per Hour (₹)" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})}/><button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700">Deploy Station</button></form><button onClick={()=>setShowHostModal(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X size={18}/></button></div></div>}
    </div>
  );
}

export default App;
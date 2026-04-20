const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Database paths
const usersFile = path.join(__dirname, 'users.json');
const bookingsFile = path.join(__dirname, 'bookings.json');
const seatsFile = path.join(__dirname, 'seats.json');

// Initialize database files
const initDB = () => {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
  }
  if (!fs.existsSync(bookingsFile)) {
    fs.writeFileSync(bookingsFile, JSON.stringify([]));
  }
  if (!fs.existsSync(seatsFile)) {
    const defaultSeats = generateAircraftSeats();
    fs.writeFileSync(seatsFile, JSON.stringify(defaultSeats));
  }
};

// Generate aircraft seat map
const generateAircraftSeats = () => {
  const seats = [];
  const rows = 30;
  const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  for (let i = 1; i <= rows; i++) {
    for (const col of columns) {
      const seatType = i <= 6 ? 'business' : (col === 'A' || col === 'F' ? 'window' : 'standard');
      seats.push({
        id: `${i}${col}`,
        row: i,
        column: col,
        type: seatType,
        available: Math.random() > 0.3,
        price: i <= 6 ? 500 : (seatType === 'window' ? 250 : 200)
      });
    }
  }
  return seats;
};

// Read from file
const readUsers = () => JSON.parse(fs.readFileSync(usersFile));
const readBookings = () => JSON.parse(fs.readFileSync(bookingsFile));
const readSeats = () => JSON.parse(fs.readFileSync(seatsFile));

// Write to file
const writeUsers = (data) => fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
const writeBookings = (data) => fs.writeFileSync(bookingsFile, JSON.stringify(data, null, 2));
const writeSeats = (data) => fs.writeFileSync(seatsFile, JSON.stringify(data, null, 2));

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, confirmPassword } = req.body;

  if (!fullName || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    id: Date.now().toString(),
    fullName,
    email,
    password: hashedPassword,
    createdAt: new Date()
  };

  users.push(newUser);
  writeUsers(users);

  const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ 
    message: 'User registered successfully',
    token,
    user: { id: newUser.id, fullName, email }
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ 
    message: 'Login successful',
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email }
  });
});

// Forgot password
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(200).json({ message: 'If the account exists, a reset code has been sent.' });
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetCode = resetCode;
  user.resetExpires = Date.now() + 3600000; // 1 hour
  writeUsers(users);

  res.json({ message: 'Password reset code generated. Use the code to reset your password.', resetCode });
});

// Reset password
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword, confirmPassword } = req.body;
  if (!email || !code || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === email);

  if (!user || !user.resetCode || user.resetCode !== code || Date.now() > user.resetExpires) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  delete user.resetCode;
  delete user.resetExpires;
  writeUsers(users);

  res.json({ message: 'Password has been reset successfully. You may now sign in.' });
});

// Get current user
app.get('/api/auth/me', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ 
    user: { id: user.id, fullName: user.fullName, email: user.email }
  });
});

// ==================== FLIGHTS ROUTES ====================

app.get('/api/flights', (req, res) => {
  const flights = [
    { id: 1, from: 'Tokyo', to: 'Dubai', departure: '06:45', arrival: '16:05', duration: '9h 20m', price: 429, stops: 0, cabin: 'Business' },
    { id: 2, from: 'Tokyo', to: 'Dubai', departure: '09:20', arrival: '20:35', duration: '11h 15m', price: 349, stops: 1, cabin: 'Economy' },
    { id: 3, from: 'Tokyo', to: 'Dubai', departure: '13:00', arrival: '21:50', duration: '8h 50m', price: 489, stops: 0, cabin: 'Premium Economy' },
    { id: 4, from: 'Manila', to: 'Tokyo', departure: '08:30', arrival: '14:00', duration: '4h 30m', price: 299, stops: 0, cabin: 'Economy' },
    { id: 5, from: 'Seoul', to: 'Dubai', departure: '11:15', arrival: '18:45', duration: '8h 30m', price: 379, stops: 0, cabin: 'Business' }
  ];
  res.json(flights);
});

// ==================== SEATS ROUTES ====================

app.get('/api/seats', (req, res) => {
  const seats = readSeats();
  res.json(seats);
});

app.post('/api/seats/reserve', verifyToken, (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();
  const seat = seats.find(s => s.id === seatId);

  if (!seat) {
    return res.status(404).json({ error: 'Seat not found' });
  }

  if (!seat.available) {
    return res.status(400).json({ error: 'Seat is already booked' });
  }

  seat.available = false;
  seat.bookedBy = req.userId;
  writeSeats(seats);

  res.json({ message: 'Seat reserved successfully', seat });
});

// ==================== BOOKINGS ROUTES ====================

app.post('/api/bookings', verifyToken, (req, res) => {
  const { flightId, selectedSeats, passengers, totalPrice } = req.body;

  const booking = {
    id: `BK${Date.now()}`,
    userId: req.userId,
    flightId,
    selectedSeats,
    passengers,
    totalPrice,
    status: 'confirmed',
    createdAt: new Date()
  };

  const bookings = readBookings();
  bookings.push(booking);
  writeBookings(bookings);

  res.status(201).json({ 
    message: 'Booking created successfully',
    booking
  });
});

app.get('/api/bookings', verifyToken, (req, res) => {
  const bookings = readBookings().filter(b => b.userId === req.userId);
  res.json(bookings);
});

// ==================== START SERVER ====================

initDB();

const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, host, () => {
  console.log(`🚀 Springfall Airlines API running on http://${host}:${PORT}`);
  console.log(`📁 Database initialized`);
});

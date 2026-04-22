const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

dotenv.config();

console.log('🚀 Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_jwt_key_2026_airline_app_secure_random_string';

// Database setup
let db;
let useSQLite = false;

if (process.env.NODE_ENV === 'development' && (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('railway.internal'))) {
  console.log('🔄 Using SQLite for local development');
  useSQLite = true;
  db = new sqlite3.Database('./airline.db', (err) => {
    if (err) {
      console.error('❌ SQLite connection error:', err.message);
    } else {
      console.log('✅ Connected to SQLite database');
    }
  });
} else {

let connectionConfig;

if (process.env.DATABASE_URL) {
  console.log('🔍 Using DATABASE_URL for connection');
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  };
} else if (process.env.DATABASE_PRIVATE_URL) {
  console.log('🔍 Using DATABASE_PRIVATE_URL for connection');
  connectionConfig = {
    connectionString: process.env.DATABASE_PRIVATE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  };
} else if (process.env.RAILWAY_DATABASE_URL) {
  console.log('🔍 Using RAILWAY_DATABASE_URL for connection');
  connectionConfig = {
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  };
} else if (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD) {
  console.log('🔍 Constructing connection from PG* variables');
  connectionConfig = {
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  };
} else if (process.env.RAILWAY_PGHOST && process.env.RAILWAY_PGDATABASE && process.env.RAILWAY_PGUSER && process.env.RAILWAY_PGPASSWORD) {
  console.log('🔍 Constructing connection from RAILWAY_PG* variables');
  connectionConfig = {
    host: process.env.RAILWAY_PGHOST,
    port: process.env.RAILWAY_PGPORT || 5432,
    database: process.env.RAILWAY_PGDATABASE,
    user: process.env.RAILWAY_PGUSER,
    password: process.env.RAILWAY_PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  };
} else {
  console.error('❌ No database configuration found!');
  console.error('Railway environment variables needed:');
  console.error('- DATABASE_URL or DATABASE_PRIVATE_URL or RAILWAY_DATABASE_URL');
  console.error('- Or PGHOST, PGDATABASE, PGUSER, PGPASSWORD');
  console.error('- Or RAILWAY_PGHOST, RAILWAY_PGDATABASE, RAILWAY_PGUSER, RAILWAY_PGPASSWORD');
  console.error('🔍 Available database env vars:', Object.keys(process.env).filter(key => 
    key.includes('DATABASE') || key.includes('DB_') || key.includes('PG') || key.includes('POSTGRES') || key.includes('RAILWAY')
  ));
  
  // TEMPORARY FALLBACK: Try common Railway patterns
  console.log('🔍 Trying fallback connection patterns...');
  
  // Try to find any postgres URL
  const postgresUrl = Object.values(process.env).find(val => 
    typeof val === 'string' && val.startsWith('postgresql://')
  );
  
  if (postgresUrl) {
    console.log('🔍 Found postgres URL, using as fallback');
    connectionConfig = {
      connectionString: postgresUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
    };
  } else {
    console.error('❌ No postgres URL found, exiting');
    process.exit(1);
  }
}

console.log('✅ Connection config created:', {
  hasConnectionString: !!connectionConfig.connectionString,
  hasHost: !!connectionConfig.host,
  connectionStringPreview: connectionConfig.connectionString ? connectionConfig.connectionString.substring(0, 30) + '...' : 'N/A',
  host: connectionConfig.host || 'N/A',
  database: connectionConfig.database || 'N/A',
  user: connectionConfig.user || 'N/A',
  ssl: connectionConfig.ssl
});

const pool = new Pool(connectionConfig);

console.log('🔍 Connection config being used:', {
  hasConnectionString: !!connectionConfig.connectionString,
  hasHost: !!connectionConfig.host,
  ssl: connectionConfig.ssl,
  connectionTimeoutMillis: connectionConfig.connectionTimeoutMillis
});

// Test connection immediately
pool.on('connect', (client) => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize database tables
const initDB = async () => {
  try {
    console.log('Initializing database...');
    console.log('Use SQLite:', useSQLite);
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

    if (useSQLite) {
      // SQLite table creation
      await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          reset_code TEXT,
          reset_expires DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Users table created/verified (SQLite)');

      await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS seats (
          id TEXT PRIMARY KEY,
          row_number INTEGER NOT NULL,
          column_letter TEXT NOT NULL,
          type TEXT NOT NULL,
          available INTEGER DEFAULT 1,
          booked_by INTEGER,
          price REAL NOT NULL
        )`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Seats table created/verified (SQLite)');

      await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          flight_id INTEGER NOT NULL,
          selected_seats TEXT NOT NULL,
          passengers TEXT NOT NULL,
          total_price REAL NOT NULL,
          status TEXT DEFAULT 'confirmed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Bookings table created/verified (SQLite)');
    } else {
      // PostgreSQL table creation
      await db.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        reset_code VARCHAR(10),
        reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('Users table created/verified (PostgreSQL)');

      await db.query(`CREATE TABLE IF NOT EXISTS seats (
        id VARCHAR(10) PRIMARY KEY,
        row_number INTEGER NOT NULL,
        column_letter VARCHAR(1) NOT NULL,
        type VARCHAR(20) NOT NULL,
        available BOOLEAN DEFAULT true,
        booked_by INTEGER REFERENCES users(id),
        price DECIMAL(10,2) NOT NULL
      )`);
      console.log('Seats table created/verified (PostgreSQL)');

      await db.query(`CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(20) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        flight_id INTEGER NOT NULL,
        selected_seats JSONB,
        passengers JSONB NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('Bookings table created/verified (PostgreSQL)');
    }

    // Initialize seats if empty
    const seatsResult = await pool.query('SELECT COUNT(*) FROM seats');
    if (parseInt(seatsResult.rows[0].count) === 0) {
      console.log('Initializing seats...');
      await initializeSeats();
      console.log('Seats initialized');
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  }
};

// Initialize aircraft seats
const initializeSeats = async () => {
  const seats = [];
  const rows = 30;
  const columns = ['A', 'B', 'C', 'D', 'E', 'F'];

  for (let i = 1; i <= rows; i++) {
    for (const col of columns) {
      const seatType = i <= 6 ? 'business' : (col === 'A' || col === 'F' ? 'window' : 'standard');
      const price = i <= 6 ? 500 : (seatType === 'window' ? 250 : 200);

      seats.push({
        id: `${i}${col}`,
        row_number: i,
        column_letter: col,
        type: seatType,
        available: Math.random() > 0.3,
        price: price
      });
    }
  }

  for (const seat of seats) {
    await pool.query(
      'INSERT INTO seats (id, row_number, column_letter, type, available, price) VALUES ($1, $2, $3, $4, $5, $6)',
      [seat.id, seat.row_number, seat.column_letter, seat.type, seat.available, seat.price]
    );
  }
};

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
app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password, confirmPassword } = req.body;

  if (!fullName || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    console.log('Registration attempt for:', email);

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('User already exists:', email);
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    console.log('Password hashed, inserting user...');

    const result = await pool.query(
      'INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [fullName, email, hashedPassword]
    );

    console.log('User inserted, ID:', result.rows[0].id);
    console.log('JWT_SECRET available:', !!process.env.JWT_SECRET);

    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('JWT token created');

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.rows[0].id, fullName, email }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(200).json({ message: 'If the account exists, a reset code has been sent.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_code = $1, reset_expires = $2 WHERE id = $3',
      [resetCode, resetExpires, user.id]
    );

    res.json({ message: 'Password reset code generated. Use the code to reset your password.', resetCode });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to generate reset code' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword, confirmPassword } = req.body;
  if (!email || !code || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !user.reset_code || user.reset_code !== code || new Date() > user.reset_expires) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, reset_code = NULL, reset_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.json({ message: 'Password has been reset successfully. You may now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: { id: user.id, fullName: user.full_name, email: user.email }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
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

app.get('/api/seats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM seats ORDER BY row_number, column_letter');
    res.json(result.rows);
  } catch (error) {
    console.error('Get seats error:', error);
    res.status(500).json({ error: 'Failed to get seats' });
  }
});

app.post('/api/seats/reserve', verifyToken, async (req, res) => {
  const { seatId } = req.body;

  try {
    const result = await pool.query('SELECT * FROM seats WHERE id = $1', [seatId]);
    const seat = result.rows[0];

    if (!seat) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    if (!seat.available) {
      return res.status(400).json({ error: 'Seat is already booked' });
    }

    await pool.query(
      'UPDATE seats SET available = false, booked_by = $1 WHERE id = $2',
      [req.userId, seatId]
    );

    res.json({ message: 'Seat reserved successfully', seat: { ...seat, available: false, booked_by: req.userId } });
  } catch (error) {
    console.error('Reserve seat error:', error);
    res.status(500).json({ error: 'Failed to reserve seat' });
  }
});

// ==================== BOOKINGS ROUTES ====================

// ==================== BOOKINGS ROUTES ====================

app.post('/api/bookings', verifyToken, async (req, res) => {
  const { flightId, selectedSeats, passengers, totalPrice } = req.body;

  try {
    // Generate unique booking ID
    const bookingId = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const result = await pool.query(
      'INSERT INTO bookings (id, user_id, flight_id, selected_seats, passengers, total_price, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [bookingId, req.userId, flightId, JSON.stringify(selectedSeats), JSON.stringify(passengers), totalPrice, 'confirmed']
    );

    const booking = result.rows[0];
    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        id: booking.id,
        userId: booking.user_id,
        flightId: booking.flight_id,
        selectedSeats: JSON.parse(booking.selected_seats),
        passengers: JSON.parse(booking.passengers),
        totalPrice: booking.total_price,
        status: booking.status,
        createdAt: booking.created_at
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.get('/api/bookings', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    const bookings = result.rows.map(booking => ({
      id: booking.id,
      userId: booking.user_id,
      flightId: booking.flight_id,
      selectedSeats: JSON.parse(booking.selected_seats),
      passengers: JSON.parse(booking.passengers),
      totalPrice: booking.total_price,
      status: booking.status,
      createdAt: booking.created_at
    }));

    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// ==================== START SERVER ====================

const startServer = async () => {
  await initDB();

  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  app.listen(PORT, host, () => {
    console.log(`🚀 Springfall Airlines API running on http://${host}:${PORT}`);
    console.log(`📁 Database initialized`);
  });
};

startServer();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

console.log('Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

// ==================== DATABASE CONNECTION ====================

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.RAILWAY_DATABASE_URL ||
  null;

if (!connectionString) {
  console.error('No database connection string found. Set DATABASE_URL.');
  process.exit(1);
}

console.log('Using connection string:', connectionString.substring(0, 30) + '...');

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', function () { console.log('DB pool: new client connected'); });
pool.on('error', function (err) { console.error('DB pool error:', err.message); });

// ==================== CORS ====================

app.use(cors({
  origin: 'https://springtrap10252.github.io',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.static(__dirname));

// ==================== DATABASE INIT ====================

// Build all 180 seat rows and insert in a single batch query
const initializeSeats = async function () {
  const numRows = 30;
  const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
  const valueClauses = [];
  const params = [];
  let idx = 1;

  for (let i = 1; i <= numRows; i++) {
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const seatType = i <= 6 ? 'business' : (col === 'A' || col === 'F' ? 'window' : 'standard');
      const price = i <= 6 ? 500 : (seatType === 'window' ? 250 : 200);
      const available = Math.random() > 0.3;

      // Build placeholder tuple with string concatenation (avoids $ interpolation issues)
      const a = idx, b = idx + 1, c2 = idx + 2, d = idx + 3, e = idx + 4, f = idx + 5;
      idx += 6;
      valueClauses.push('(' + '$' + a + ', ' + '$' + b + ', ' + '$' + c2 + ', ' + '$' + d + ', ' + '$' + e + ', ' + '$' + f + ')');
      params.push(String(i) + col, i, col, seatType, available, price);
    }
  }

  const sql = 'INSERT INTO seats (id, row_number, column_letter, type, available, price) VALUES ' + valueClauses.join(', ');
  await pool.query(sql, params);
  console.log('Inserted ' + String(numRows * columns.length) + ' seats in a single batch query');
};

const initDB = async function () {
  console.log('Initializing database tables...');

  await pool.query(
    'CREATE TABLE IF NOT EXISTS users (' +
    '  id SERIAL PRIMARY KEY,' +
    '  full_name VARCHAR(255) NOT NULL,' +
    '  email VARCHAR(255) UNIQUE NOT NULL,' +
    '  password VARCHAR(255) NOT NULL,' +
    '  reset_code VARCHAR(10),' +
    '  reset_expires TIMESTAMP,' +
    '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );
  console.log('Users table ready');

  await pool.query(
    'CREATE TABLE IF NOT EXISTS seats (' +
    '  id VARCHAR(10) PRIMARY KEY,' +
    '  row_number INTEGER NOT NULL,' +
    '  column_letter VARCHAR(1) NOT NULL,' +
    '  type VARCHAR(20) NOT NULL,' +
    '  available BOOLEAN DEFAULT true,' +
    '  booked_by INTEGER REFERENCES users(id),' +
    '  price DECIMAL(10,2) NOT NULL' +
    ')'
  );
  console.log('Seats table ready');

  await pool.query(
    'CREATE TABLE IF NOT EXISTS bookings (' +
    '  id VARCHAR(20) PRIMARY KEY,' +
    '  user_id INTEGER REFERENCES users(id),' +
    '  flight_id INTEGER NOT NULL,' +
    '  selected_seats JSONB,' +
    '  passengers INTEGER NOT NULL,' +
    '  total_price DECIMAL(10,2) NOT NULL,' +
    "  status VARCHAR(20) DEFAULT 'confirmed'," +
    '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );
  console.log('Bookings table ready');

  const countResult = await pool.query('SELECT COUNT(*) FROM seats');
  if (parseInt(countResult.rows[0].count) === 0) {
    console.log('Seeding seats...');
    await initializeSeats();
  } else {
    console.log('Seats already seeded (' + countResult.rows[0].count + ' rows), skipping');
  }

  console.log('Database initialized successfully');
};

// ==================== AUTH MIDDLEWARE ====================

const verifyToken = function (req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, function (err, decoded) {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async function (req, res) {
  const fullName = req.body.fullName;
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  if (!fullName || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    console.log('Registration attempt for:', email);

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [fullName, email, hashedPassword]
    );

    const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token: token,
      user: { id: result.rows[0].id, fullName: fullName, email: email }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async function (req, res) {
  const email = req.body.email;
  const password = req.body.password;

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
      token: token,
      user: { id: user.id, fullName: user.full_name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/forgot-password', async function (req, res) {
  const email = req.body.email;
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
    const resetExpires = new Date(Date.now() + 3600000);

    await pool.query(
      'UPDATE users SET reset_code = $1, reset_expires = $2 WHERE id = $3',
      [resetCode, resetExpires, user.id]
    );

    res.json({ message: 'Password reset code generated. Use the code to reset your password.', resetCode: resetCode });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Failed to generate reset code' });
  }
});

app.post('/api/auth/reset-password', async function (req, res) {
  const email = req.body.email;
  const code = req.body.code;
  const newPassword = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;

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
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/auth/me', verifyToken, async function (req, res) {
  try {
    const result = await pool.query('SELECT id, full_name, email FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: { id: user.id, fullName: user.full_name, email: user.email } });
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== FLIGHTS ROUTES ====================

app.get('/api/flights', function (req, res) {
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

app.get('/api/seats', async function (req, res) {
  try {
    const result = await pool.query('SELECT * FROM seats ORDER BY row_number, column_letter');
    res.json(result.rows);
  } catch (error) {
    console.error('Get seats error:', error.message);
    res.status(500).json({ error: 'Failed to get seats' });
  }
});

app.post('/api/seats/reserve', verifyToken, async function (req, res) {
  const seatId = req.body.seatId;

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

    res.json({ message: 'Seat reserved successfully', seat: Object.assign({}, seat, { available: false, booked_by: req.userId }) });
  } catch (error) {
    console.error('Reserve seat error:', error.message);
    res.status(500).json({ error: 'Failed to reserve seat' });
  }
});

// ==================== BOOKINGS ROUTES ====================

app.post('/api/bookings', verifyToken, async function (req, res) {
  const flightId = req.body.flightId;
  const selectedSeats = req.body.selectedSeats;
  const passengers = req.body.passengers;
  const totalPrice = req.body.totalPrice;

  try {
    const result = await pool.query(
      'INSERT INTO bookings (user_id, flight_id, selected_seats, passengers, total_price, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.userId, flightId, JSON.stringify(selectedSeats), JSON.stringify(passengers), totalPrice, 'confirmed']
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
    console.error('Create booking error:', error.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.get('/api/bookings', verifyToken, async function (req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    const bookings = result.rows.map(function (booking) {
      return {
        id: booking.id,
        userId: booking.user_id,
        flightId: booking.flight_id,
        selectedSeats: JSON.parse(booking.selected_seats),
        passengers: JSON.parse(booking.passengers),
        totalPrice: booking.total_price,
        status: booking.status,
        createdAt: booking.created_at
      };
    });

    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error.message);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// ==================== START SERVER ====================

const startServer = async function () {
  // 1. Test DB connection with retry + exponential backoff
  let connected = false;
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log('Testing DB connection (attempt ' + attempt + '/' + maxAttempts + ')...');
      const client = await pool.connect();
      client.release();
      console.log('DB connection test passed');
      connected = true;
      break;
    } catch (err) {
      console.error('DB connection attempt ' + attempt + ' failed:', err.message);
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        console.log('Retrying in ' + delay + 'ms...');
        await new Promise(function (resolve) { setTimeout(resolve, delay); });
      }
    }
  }

  if (!connected) {
    console.error('Could not connect to database after ' + maxAttempts + ' attempts. Exiting.');
    process.exit(1);
  }

  // 2. Initialize tables and seed data
  try {
    await initDB();
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // 3. Start HTTP server
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  app.listen(PORT, host, function () {
    console.log('Springfall Airlines API running on http://' + host + ':' + PORT);
  });
};

startServer();

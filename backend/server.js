require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const socketHandler = require('./sockets/socketHandler');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Clean the Frontend URL (removes trailing slash if present)
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible in controllers
app.set('io', io);

// Socket handler
socketHandler(io);

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));

// CORS - Allow frontend, ESP32, and other clients
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, ESP32)
    if (!origin) return callback(null, true);
    // Allow frontend
    if (origin === frontendUrl) return callback(null, true);
    // Allow localhost for development
    if (origin.includes('localhost')) return callback(null, true);
    // Allow all for public API (ESP32 can connect from anywhere)
    return callback(null, true);
  },
  credentials: true,
}));

// Rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/blocks', require('./routes/blocks'));
app.use('/api/floors', require('./routes/floors'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/detection', require('./routes/detection'));
app.use('/api/users', require('./routes/users'));
app.use('/api/voice', require('./routes/voice'));

// Dashboard stats route (admin)
app.get('/api/dashboard/stats', require('./middleware/auth').protect, require('./middleware/auth').adminOnly, async (req, res) => {
  const { getDashboardStats } = require('./controllers/userController');
  return getDashboardStats(req, res);
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

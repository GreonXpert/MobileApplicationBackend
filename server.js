// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const fingerprintRoutes = require('./routes/fingerprintRoutes'); // ✅ NEW

// ✅ Startup seeding
const { ensureInitialUsers } = require('./controllers/setupController');
const setupRoutes = require('./routes/setupRoutes');

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Auto Attendance Tracking System API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      superadmin: '/api/superadmin',
      fingerprints: '/api/fingerprints', // ✅ NEW
      setup: '/api/setup',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/fingerprints', fingerprintRoutes); // ✅ NEW

// Optional manual seed route (protected by SETUP_KEY if provided)
app.use('/api/setup', setupRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

async function start() {
  // ✅ Connect DB once
  await connectDB();

  // ✅ Auto-create superadmin/admin from .env
  await ensureInitialUsers();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('');
    console.log('================================================');
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('================================================');
    console.log('');
  });
}

start().catch((err) => {
  console.error('❌ Startup error:', err);
  process.exit(1);
});
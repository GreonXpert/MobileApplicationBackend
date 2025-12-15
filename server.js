// server.js
/**
 * Main Server File for Auto Attendance Tracking System
 * 
 * This is the entry point of the backend application.
 * It sets up Express server, connects to MongoDB, and configures all routes.
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superadminRoutes = require('./routes/superadminRoutes');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
// Enable CORS for all origins (configure this properly in production)
app.use(cors({
  origin: '*', // In production, specify your frontend URL
  credentials: true,
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' })); // Increased limit for fingerprint templates

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (helpful for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check route
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
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);           // Authentication routes (login)
app.use('/api/admin', adminRoutes);         // Admin routes (employee & attendance management)
app.use('/api/superadmin', superadminRoutes); // Superadmin routes (attendance feed)

// 404 handler for undefined routes
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

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('================================================');
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('================================================');
  console.log('');
  console.log('Available Routes:');
  console.log(`  - POST   /api/auth/login`);
  console.log(`  - GET    /api/auth/verify`);
  console.log(`  - POST   /api/admin/employees`);
  console.log(`  - GET    /api/admin/employees`);
  console.log(`  - GET    /api/admin/employees/:id`);
  console.log(`  - POST   /api/admin/attendance/mark`);
  console.log(`  - GET    /api/admin/attendance/history/:employeeId`);
  console.log(`  - GET    /api/superadmin/attendance`);
  console.log(`  - GET    /api/superadmin/attendance/:employeeId`);
  console.log(`  - GET    /api/superadmin/employees`);
  console.log(`  - GET    /api/superadmin/statistics`);
  console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

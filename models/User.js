// models/User.js
const mongoose = require('mongoose');

/**
 * User Schema
 * 
 * This model is NOT stored in the database for this application.
 * Instead, Admin and Superadmin credentials are configured in .env file.
 * This schema serves as a reference for the structure we use in authentication.
 * 
 * In a production system, you might want to store these in the database,
 * but per requirements, we're using environment variables for simplicity.
 */
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['ADMIN', 'SUPERADMIN'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Note: We're exporting this schema but not actively using it
// since users are configured via .env
module.exports = mongoose.model('User', userSchema);

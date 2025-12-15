// models/Employee.js
const mongoose = require('mongoose');

/**
 * Employee Schema
 * 
 * Stores employee information including their fingerprint template.
 * The fingerprintTemplate field stores the raw biometric data as captured
 * from MFS100 or Precision PB100 fingerprint scanner SDK.
 * 
 * IMPORTANT: fingerprintTemplate is stored "as-is" from the SDK output.
 * No transformation or processing is done on this field.
 */
const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true,
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true,
    index: true, // Index for faster queries
  },
  jobRole: {
    type: String,
    required: [true, 'Job role is required'],
    trim: true,
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
  },
  
  /**
   * Fingerprint Template
   * This field stores the raw fingerprint template from MFS100/Precision PB100 SDK
   * Format: String (can be base64, hex, or any format the SDK provides)
   * 
   * ⚠️ SDK INTEGRATION POINT:
   * In production, this value comes from the fingerprint scanner SDK
   * (MFS100 or Precision PB100). The SDK captures the fingerprint and
   * returns a template string which is stored here without modification.
   */
  fingerprintTemplate: {
    type: String,
    required: [true, 'Fingerprint template is required'],
  },
  
  // Base location where employee is registered
  baseLocation: {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
  },
  
  // Reference to the Admin who created this employee
  createdBy: {
    type: String, // We store username since Admin is not in DB
    required: true,
  },
  
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

// Index for faster search queries
employeeSchema.index({ name: 'text', department: 'text' });

module.exports = mongoose.model('Employee', employeeSchema);

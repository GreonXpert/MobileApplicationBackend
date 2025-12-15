// models/Attendance.js
const mongoose = require('mongoose');

/**
 * Attendance Schema
 * 
 * Records attendance marks made by Admin for employees.
 * Includes the fingerprint template at the time of marking
 * (copied from Employee record) and location where attendance was marked.
 */
const attendanceSchema = new mongoose.Schema({
  // Reference to Employee document
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true,
  },
  
  // Denormalized employeeId for quick queries without population
  employeeId: {
    type: String,
    required: true,
    index: true,
  },
  
  // Employee details (denormalized for quick access)
  employeeName: {
    type: String,
    required: true,
  },
  
  department: {
    type: String,
    required: true,
  },
  
  jobRole: {
    type: String,
    required: true,
  },
  
  // Date of attendance (stored as Date object for easy querying)
  date: {
    type: Date,
    required: true,
    index: true,
  },
  
  // Attendance status
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE'],
    required: true,
    default: 'PRESENT',
  },
  
  /**
   * Fingerprint Template at time of marking
   * This is copied from the Employee record when attendance is marked
   * Stored in the same format as provided by MFS100/Precision PB100 SDK
   * 
   * Purpose: Provides audit trail and can be used for verification
   */
  fingerprintTemplate: {
    type: String,
    required: true,
  },
  
  // Location where attendance was marked
  location: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  
  // Admin who marked this attendance
  markedBy: {
    type: String, // Username of the admin
    required: true,
  },
  
  // Timestamp when record was created
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
}, {
  timestamps: true,
});

// Compound index for efficient date-based queries per employee
attendanceSchema.index({ employeeId: 1, date: -1 });

// Index for date range queries
attendanceSchema.index({ date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

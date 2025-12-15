// routes/adminRoutes.js
const express = require('express');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route   POST /api/admin/employees
 * @desc    Create a new employee
 * @access  Admin only
 * 
 * Body: {
 *   name: string,
 *   employeeId: string,
 *   jobRole: string,
 *   department: string,
 *   fingerprintTemplate: string,
 *   baseLocation: { latitude: number, longitude: number }
 * }
 */
router.post('/employees', async (req, res) => {
  try {
    const {
      name,
      employeeId,
      jobRole,
      department,
      fingerprintTemplate,
      baseLocation,
    } = req.body;

    // Validate required fields
    if (!name || !employeeId || !jobRole || !department || !fingerprintTemplate) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, employeeId, jobRole, department, fingerprintTemplate',
      });
    }

    if (!baseLocation || !baseLocation.latitude || !baseLocation.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Base location with latitude and longitude is required',
      });
    }

    // Check if employee with same employeeId already exists
    const existingEmployee = await Employee.findOne({ employeeId });
    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: `Employee with ID ${employeeId} already exists`,
      });
    }

    // Create new employee
    const employee = new Employee({
      name,
      employeeId,
      jobRole,
      department,
      fingerprintTemplate, // Stored as-is from MFS100/Precision PB100 SDK
      baseLocation: {
        latitude: baseLocation.latitude,
        longitude: baseLocation.longitude,
      },
      createdBy: req.user.username, // From JWT token
    });

    // Save to database
    await employee.save();

    // Return success response (excluding sensitive fingerprint data)
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: {
        _id: employee._id,
        name: employee.name,
        employeeId: employee.employeeId,
        jobRole: employee.jobRole,
        department: employee.department,
        baseLocation: employee.baseLocation,
        createdBy: employee.createdBy,
        createdAt: employee.createdAt,
      },
    });

  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating employee',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/admin/employees
 * @desc    Get list of all employees
 * @access  Admin only
 */
router.get('/employees', async (req, res) => {
  try {
    // Fetch all employees, excluding fingerprint templates from response
    const employees = await Employee.find()
      .select('-fingerprintTemplate') // Exclude fingerprint from list view
      .sort({ createdAt: -1 }); // Most recent first

    res.json({
      success: true,
      count: employees.length,
      employees: employees,
    });

  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employees',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/admin/employees/:id
 * @desc    Get details of a specific employee
 * @access  Admin only
 */
router.get('/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('-fingerprintTemplate'); // Exclude fingerprint from detail view

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    res.json({
      success: true,
      employee: employee,
    });

  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employee',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/admin/attendance/mark
 * @desc    Mark attendance for an employee
 * @access  Admin only
 * 
 * Body: {
 *   employeeId: string,
 *   date: string (ISO date),
 *   status: string ('PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE'),
 *   location: { latitude: number, longitude: number }
 * }
 * 
 * Flow:
 * 1. Find employee by employeeId
 * 2. Retrieve fingerprint template from employee record
 * 3. Create attendance record with all details including fingerprint
 * 4. Save to database (accessible by Superadmin via their routes)
 */
router.post('/attendance/mark', async (req, res) => {
  try {
    const { employeeId, date, status, location } = req.body;

    // Validate required fields
    if (!employeeId || !date || !status || !location) {
      return res.status(400).json({
        success: false,
        message: 'employeeId, date, status, and location are required',
      });
    }

    if (!location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location must include latitude and longitude',
      });
    }

    // Find employee by employeeId
    const employee = await Employee.findOne({ employeeId });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`,
      });
    }

    // Parse date
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use ISO date string.',
      });
    }

    // Check if attendance already marked for this employee on this date
    const existingAttendance = await Attendance.findOne({
      employeeId: employeeId,
      date: {
        $gte: new Date(attendanceDate.setHours(0, 0, 0, 0)),
        $lt: new Date(attendanceDate.setHours(23, 59, 59, 999)),
      },
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already marked for this employee on this date',
        existingAttendance: {
          _id: existingAttendance._id,
          status: existingAttendance.status,
          markedAt: existingAttendance.createdAt,
        },
      });
    }

    // Create attendance record
    // Including fingerprint template from employee record
    const attendance = new Attendance({
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      jobRole: employee.jobRole,
      date: attendanceDate,
      status: status,
      fingerprintTemplate: employee.fingerprintTemplate, // Copy from employee
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      markedBy: req.user.username, // Admin username from JWT
    });

    // Save attendance record
    await attendance.save();

    // Return success response
    // Note: Fingerprint template is now stored in Attendance collection
    // and is accessible to Superadmin via /api/superadmin/attendance routes
    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      attendance: {
        _id: attendance._id,
        employeeId: attendance.employeeId,
        employeeName: attendance.employeeName,
        department: attendance.department,
        jobRole: attendance.jobRole,
        date: attendance.date,
        status: attendance.status,
        location: attendance.location,
        markedBy: attendance.markedBy,
        createdAt: attendance.createdAt,
      },
    });

  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking attendance',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/admin/attendance/history/:employeeId
 * @desc    Get attendance history for a specific employee
 * @access  Admin only
 */
router.get('/attendance/history/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    // Build query
    let query = { employeeId };

    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .select('-fingerprintTemplate') // Exclude fingerprint from response
      .sort({ date: -1 }); // Most recent first

    res.json({
      success: true,
      count: attendanceRecords.length,
      employeeId: employeeId,
      attendance: attendanceRecords,
    });

  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance history',
      error: error.message,
    });
  }
});

module.exports = router;

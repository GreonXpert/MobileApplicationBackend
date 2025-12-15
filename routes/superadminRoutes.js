// routes/superadminRoutes.js
const express = require('express');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { authenticateToken, requireSuperadmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all superadmin routes
router.use(authenticateToken);
router.use(requireSuperadmin);

/**
 * @route   GET /api/superadmin/attendance
 * @desc    Get all attendance records (Superadmin feed)
 * @access  Superadmin only
 * 
 * Query parameters:
 * - startDate: Filter records from this date onwards (ISO format)
 * - endDate: Filter records up to this date (ISO format)
 * - employeeId: Filter by specific employee
 * - department: Filter by department
 * - status: Filter by attendance status
 * - page: Page number for pagination (default: 1)
 * - limit: Records per page (default: 50)
 * 
 * This endpoint returns the complete attendance feed including fingerprint templates.
 * This is the "Superadmin-accessible URL" mentioned in requirements.
 */
router.get('/attendance', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employeeId,
      department,
      status,
      page = 1,
      limit = 50,
    } = req.query;

    // Build query filter
    let filter = {};

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Employee filter
    if (employeeId) {
      filter.employeeId = employeeId;
    }

    // Department filter
    if (department) {
      filter.department = department;
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch attendance records with all fields including fingerprintTemplate
    const attendanceRecords = await Attendance.find(filter)
      .sort({ date: -1, createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employee', 'name employeeId department jobRole'); // Populate employee details

    // Get total count for pagination
    const totalRecords = await Attendance.countDocuments(filter);

    // Response with complete attendance data including fingerprint templates
    res.json({
      success: true,
      message: 'Attendance feed retrieved successfully',
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / parseInt(limit)),
        totalRecords: totalRecords,
        recordsPerPage: parseInt(limit),
      },
      filters: {
        startDate: startDate || 'All',
        endDate: endDate || 'All',
        employeeId: employeeId || 'All',
        department: department || 'All',
        status: status || 'All',
      },
      attendance: attendanceRecords.map(record => ({
        _id: record._id,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        department: record.department,
        jobRole: record.jobRole,
        attendanceDate: record.date,
        attendanceStatus: record.status,
        fingerprintTemplate: record.fingerprintTemplate, // ⚠️ Included for Superadmin
        location: {
          latitude: record.location.latitude,
          longitude: record.location.longitude,
        },
        markedBy: record.markedBy,
        markedAt: record.createdAt,
      })),
    });

  } catch (error) {
    console.error('Error fetching attendance feed:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance feed',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/superadmin/attendance/:employeeId
 * @desc    Get complete attendance history for a specific employee
 * @access  Superadmin only
 * 
 * Returns all attendance records for one employee including fingerprint data
 */
router.get('/attendance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    // Build query
    let query = { employeeId };

    // Add date range if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Fetch attendance records with fingerprint templates
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1 })
      .populate('employee', 'name department jobRole baseLocation');

    if (attendanceRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No attendance records found for employee ${employeeId}`,
      });
    }

    // Calculate attendance statistics
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
    const halfDayCount = attendanceRecords.filter(r => r.status === 'HALF_DAY').length;

    res.json({
      success: true,
      employeeId: employeeId,
      employeeDetails: attendanceRecords[0].employee,
      statistics: {
        totalRecords: totalRecords,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount,
        attendancePercentage: ((presentCount + halfDayCount * 0.5) / totalRecords * 100).toFixed(2),
      },
      attendance: attendanceRecords.map(record => ({
        _id: record._id,
        date: record.date,
        status: record.status,
        fingerprintTemplate: record.fingerprintTemplate, // ⚠️ Included for Superadmin
        location: record.location,
        markedBy: record.markedBy,
        markedAt: record.createdAt,
      })),
    });

  } catch (error) {
    console.error('Error fetching employee attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employee attendance',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/superadmin/employees
 * @desc    Get all employees with their fingerprint data
 * @access  Superadmin only
 * 
 * Superadmin can view all employee records including fingerprint templates
 */
router.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: employees.length,
      employees: employees.map(emp => ({
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        jobRole: emp.jobRole,
        department: emp.department,
        fingerprintTemplate: emp.fingerprintTemplate, // ⚠️ Included for Superadmin
        baseLocation: emp.baseLocation,
        createdBy: emp.createdBy,
        createdAt: emp.createdAt,
      })),
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
 * @route   GET /api/superadmin/statistics
 * @desc    Get overall attendance statistics
 * @access  Superadmin only
 */
router.get('/statistics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        dateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.date.$lte = new Date(endDate);
      }
    }

    // Get counts
    const totalEmployees = await Employee.countDocuments();
    const totalAttendanceRecords = await Attendance.countDocuments(dateFilter);
    const presentCount = await Attendance.countDocuments({ ...dateFilter, status: 'PRESENT' });
    const absentCount = await Attendance.countDocuments({ ...dateFilter, status: 'ABSENT' });
    const lateCount = await Attendance.countDocuments({ ...dateFilter, status: 'LATE' });

    // Get department-wise statistics
    const departmentStats = await Attendance.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$department',
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] }
          },
        },
      },
    ]);

    res.json({
      success: true,
      statistics: {
        totalEmployees: totalEmployees,
        totalAttendanceRecords: totalAttendanceRecords,
        statusBreakdown: {
          present: presentCount,
          absent: absentCount,
          late: lateCount,
        },
        overallAttendanceRate: totalAttendanceRecords > 0
          ? ((presentCount / totalAttendanceRecords) * 100).toFixed(2) + '%'
          : '0%',
        departmentWise: departmentStats,
      },
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics',
      error: error.message,
    });
  }
});

module.exports = router;

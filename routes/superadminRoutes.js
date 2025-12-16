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


/**
 * @route   GET /api/superadmin/dashboard/overview
 * @desc    Get comprehensive dashboard overview for superadmin
 * @access  Superadmin only
 */
router.get('/dashboard/overview', async (req, res) => {
  try {
    // System-wide statistics
    const totalEmployees = await Employee.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'ADMIN' });
    const totalAttendanceRecords = await Attendance.countDocuments();

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow }
    });

    // This week's stats
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekAttendance = await Attendance.find({
      date: { $gte: weekStart, $lt: weekEnd }
    });

    // Department-wise analysis
    const departments = await Employee.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    // Admin activity (who marked most attendance)
    const adminActivity = await Attendance.aggregate([
      {
        $group: {
          _id: '$markedBy',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Recent attendance trends (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const dayAttendance = await Attendance.countDocuments({
        date: { $gte: date, $lt: nextDate }
      });

      last7Days.push({
        date: date.toISOString().split('T')[0],
        count: dayAttendance
      });
    }

    res.json({
      success: true,
      overview: {
        system: {
          totalEmployees,
          totalAdmins,
          totalAttendanceRecords,
          systemUptime: process.uptime()
        },
        today: {
          date: today.toISOString(),
          totalMarked: todayAttendance.length,
          present: todayAttendance.filter(a => a.status === 'PRESENT').length,
          absent: todayAttendance.filter(a => a.status === 'ABSENT').length,
          late: todayAttendance.filter(a => a.status === 'LATE').length,
          halfDay: todayAttendance.filter(a => a.status === 'HALF_DAY').length
        },
        thisWeek: {
          totalMarked: weekAttendance.length,
          present: weekAttendance.filter(a => a.status === 'PRESENT').length,
          absent: weekAttendance.filter(a => a.status === 'ABSENT').length
        },
        departments: departments.map(d => ({
          name: d._id,
          employeeCount: d.count
        })),
        adminActivity: adminActivity.map(a => ({
          admin: a._id,
          attendanceMarked: a.count
        })),
        trends: {
          last7Days
        }
      }
    });

  } catch (error) {
    console.error('Error fetching superadmin overview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching overview',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/superadmin/dashboard/analytics
 * @desc    Get detailed analytics and insights
 * @access  Superadmin only
 */
router.get('/dashboard/analytics', async (req, res) => {
  try {
    const { period = 'month' } = req.query; // day, week, month, year

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate;
    switch(period) {
      case 'day':
        startDate = new Date(today);
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
    }

    // Attendance by status
    const attendanceByStatus = await Attendance.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Attendance by department
    const attendanceByDepartment = await Attendance.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] }
          }
        }
      }
    ]);

    // Top performing employees (highest attendance rate)
    const employeeStats = await Attendance.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: '$employeeId',
          employeeName: { $first: '$employeeName' },
          department: { $first: '$department' },
          totalAttendance: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          employeeId: '$_id',
          employeeName: 1,
          department: 1,
          totalAttendance: 1,
          present: 1,
          attendanceRate: {
            $multiply: [
              { $divide: ['$present', '$totalAttendance'] },
              100
            ]
          }
        }
      },
      { $sort: { attendanceRate: -1 } },
      { $limit: 10 }
    ]);

    // Average attendance rate across all employees
    const avgAttendanceRate = employeeStats.length > 0
      ? (employeeStats.reduce((sum, emp) => sum + emp.attendanceRate, 0) / employeeStats.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      period,
      analytics: {
        byStatus: attendanceByStatus.map(item => ({
          status: item._id,
          count: item.count
        })),
        byDepartment: attendanceByDepartment.map(item => ({
          department: item._id,
          total: item.count,
          present: item.present,
          absent: item.absent,
          attendanceRate: ((item.present / item.count) * 100).toFixed(2)
        })),
        topPerformers: employeeStats,
        averageAttendanceRate: avgAttendanceRate
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/superadmin/dashboard/alerts
 * @desc    Get system alerts (low attendance, missing data, etc.)
 * @access  Superadmin only
 */
router.get('/dashboard/alerts', async (req, res) => {
  try {
    const alerts = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check for low attendance today
    const totalEmployees = await Employee.countDocuments();
    const todayAttendance = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });

    const attendancePercentage = (todayAttendance / totalEmployees) * 100;
    if (attendancePercentage < 80) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        message: `Low attendance today: ${attendancePercentage.toFixed(0)}% (${todayAttendance}/${totalEmployees})`,
        timestamp: new Date()
      });
    }

    // Check for employees with no attendance in last 7 days
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const recentAttendance = await Attendance.distinct('employeeId', {
      date: { $gte: weekAgo }
    });

    const allEmployeeIds = await Employee.distinct('employeeId');
    const missingEmployees = allEmployeeIds.filter(id => !recentAttendance.includes(id));

    if (missingEmployees.length > 0) {
      alerts.push({
        type: 'alert',
        severity: 'high',
        message: `${missingEmployees.length} employees have no attendance in the last 7 days`,
        details: missingEmployees.slice(0, 5), // Show first 5
        timestamp: new Date()
      });
    }

    // Check for departments with low attendance
    const departments = await Employee.distinct('department');
    for (const dept of departments) {
      const deptEmployees = await Employee.countDocuments({ department: dept });
      const deptAttendance = await Attendance.countDocuments({
        department: dept,
        date: { $gte: today, $lt: tomorrow }
      });

      const deptRate = (deptAttendance / deptEmployees) * 100;
      if (deptRate < 70 && deptEmployees > 0) {
        alerts.push({
          type: 'warning',
          severity: 'medium',
          message: `Low attendance in ${dept}: ${deptRate.toFixed(0)}%`,
          timestamp: new Date()
        });
      }
    }

    res.json({
      success: true,
      alertCount: alerts.length,
      alerts: alerts.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching alerts',
      error: error.message
    });
  }
});


module.exports = router;

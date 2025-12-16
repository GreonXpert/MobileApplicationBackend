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

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard statistics (today's attendance, monthly summary, etc.)
 * @access  Admin only
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total employees
    const totalEmployees = await Employee.countDocuments();

    // Get today's attendance
    const todayAttendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow }
    });

    const todayPresent = todayAttendance.filter(a => a.status === 'PRESENT').length;
    const todayAbsent = todayAttendance.filter(a => a.status === 'ABSENT').length;
    const todayLate = todayAttendance.filter(a => a.status === 'LATE').length;
    const todayHalfDay = todayAttendance.filter(a => a.status === 'HALF_DAY').length;
    const todayNotMarked = totalEmployees - todayAttendance.length;

    // Get this month's stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const monthlyAttendance = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd }
    });

    const monthlyPresent = monthlyAttendance.filter(a => a.status === 'PRESENT').length;
    const monthlyAbsent = monthlyAttendance.filter(a => a.status === 'ABSENT').length;
    const monthlyLate = monthlyAttendance.filter(a => a.status === 'LATE').length;
    const monthlyHalfDay = monthlyAttendance.filter(a => a.status === 'HALF_DAY').length;

    // Get department-wise breakdown
    const departments = await Employee.distinct('department');
    const departmentStats = [];

    for (const dept of departments) {
      const deptEmployees = await Employee.countDocuments({ department: dept });
      const deptTodayAttendance = todayAttendance.filter(a => a.department === dept);
      const deptPresent = deptTodayAttendance.filter(a => a.status === 'PRESENT').length;

      departmentStats.push({
        department: dept,
        totalEmployees: deptEmployees,
        presentToday: deptPresent,
        attendanceRate: deptEmployees > 0 ? ((deptPresent / deptEmployees) * 100).toFixed(2) : 0
      });
    }

    res.json({
      success: true,
      stats: {
        totalEmployees,
        today: {
          date: today.toISOString(),
          present: todayPresent,
          absent: todayAbsent,
          late: todayLate,
          halfDay: todayHalfDay,
          notMarked: todayNotMarked,
          attendanceRate: totalEmployees > 0 ? ((todayPresent / totalEmployees) * 100).toFixed(2) : 0
        },
        monthly: {
          month: today.toLocaleString('default', { month: 'long', year: 'numeric' }),
          present: monthlyPresent,
          absent: monthlyAbsent,
          late: monthlyLate,
          halfDay: monthlyHalfDay,
          totalMarked: monthlyAttendance.length
        },
        departments: departmentStats
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/dashboard/daily-attendance
 * @desc    Get daily attendance with all employee details
 * @access  Admin only
 */
router.get('/dashboard/daily-attendance', async (req, res) => {
  try {
    const { date } = req.query;
    
    let targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all employees
    const allEmployees = await Employee.find()
      .select('-fingerprintTemplate')
      .sort({ department: 1, name: 1 });

    // Get attendance for the target date
    const attendanceRecords = await Attendance.find({
      date: { $gte: targetDate, $lt: nextDay }
    });

    // Create a map of employee attendance
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.employeeId] = {
        status: record.status,
        markedAt: record.createdAt,
        markedBy: record.markedBy,
        location: record.location,
        _id: record._id
      };
    });

    // Combine employee data with attendance
    const dailyAttendance = allEmployees.map(employee => {
      const attendance = attendanceMap[employee.employeeId];
      return {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        jobRole: employee.jobRole,
        baseLocation: employee.baseLocation,
        attendance: attendance ? {
          status: attendance.status,
          markedAt: attendance.markedAt,
          markedBy: attendance.markedBy,
          location: attendance.location,
          attendanceId: attendance._id
        } : {
          status: 'NOT_MARKED',
          markedAt: null,
          markedBy: null,
          location: null,
          attendanceId: null
        }
      };
    });

    // Calculate summary
    const summary = {
      total: allEmployees.length,
      present: attendanceRecords.filter(a => a.status === 'PRESENT').length,
      absent: attendanceRecords.filter(a => a.status === 'ABSENT').length,
      late: attendanceRecords.filter(a => a.status === 'LATE').length,
      halfDay: attendanceRecords.filter(a => a.status === 'HALF_DAY').length,
      notMarked: allEmployees.length - attendanceRecords.length
    };

    res.json({
      success: true,
      date: targetDate.toISOString(),
      summary,
      employees: dailyAttendance
    });

  } catch (error) {
    console.error('Error fetching daily attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching daily attendance',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/dashboard/employee-history/:employeeId
 * @desc    Get complete attendance history for a specific employee
 * @access  Admin only
 */
router.get('/dashboard/employee-history/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, limit = 30 } = req.query;

    // Find employee
    const employee = await Employee.findOne({ employeeId })
      .select('-fingerprintTemplate');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    // Build query
    let query = { employeeId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    // Calculate statistics
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
    const halfDayCount = attendanceRecords.filter(r => r.status === 'HALF_DAY').length;

    const attendanceRate = totalRecords > 0 
      ? ((presentCount / totalRecords) * 100).toFixed(2) 
      : 0;

    res.json({
      success: true,
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        jobRole: employee.jobRole,
        baseLocation: employee.baseLocation
      },
      statistics: {
        totalRecords,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount,
        attendanceRate: `${attendanceRate}%`
      },
      history: attendanceRecords.map(record => ({
        _id: record._id,
        date: record.date,
        status: record.status,
        location: record.location,
        markedBy: record.markedBy,
        markedAt: record.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching employee history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employee history',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/dashboard/monthly-report
 * @desc    Get monthly attendance report with date-wise breakdown
 * @access  Admin only
 */
router.get('/dashboard/monthly-report', async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();

    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Get all attendance for the month
    const monthlyAttendance = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd }
    }).sort({ date: 1 });

    // Group by date
    const dateWiseAttendance = {};
    monthlyAttendance.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      if (!dateWiseAttendance[dateKey]) {
        dateWiseAttendance[dateKey] = {
          date: dateKey,
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          total: 0
        };
      }
      dateWiseAttendance[dateKey][record.status.toLowerCase().replace('_', '')] += 1;
      dateWiseAttendance[dateKey].total += 1;
    });

    const dateWiseReport = Object.values(dateWiseAttendance);

    // Overall month statistics
    const totalPresent = monthlyAttendance.filter(a => a.status === 'PRESENT').length;
    const totalAbsent = monthlyAttendance.filter(a => a.status === 'ABSENT').length;
    const totalLate = monthlyAttendance.filter(a => a.status === 'LATE').length;
    const totalHalfDay = monthlyAttendance.filter(a => a.status === 'HALF_DAY').length;

    res.json({
      success: true,
      month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
      summary: {
        totalRecords: monthlyAttendance.length,
        present: totalPresent,
        absent: totalAbsent,
        late: totalLate,
        halfDay: totalHalfDay
      },
      dateWiseReport
    });

  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly report',
      error: error.message
    });
  }
});


module.exports = router;

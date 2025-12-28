// routes/adminRoutes.js
const express = require('express');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// EMPLOYEE MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/admin/employees
 * @desc    Create a new employee
 * @access  Admin only
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
      phone,
      email,
    } = req.body;

    // Validate required fields
    if (!name || !employeeId || !jobRole || !department || !fingerprintTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, employeeId, jobRole, department, fingerprintTemplate',
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
      phone,
      email,
      fingerprintTemplate,
      baseLocation: {
        latitude: baseLocation.latitude,
        longitude: baseLocation.longitude,
      },
      createdBy: req.user.username,
    });

    await employee.save();

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: {
        _id: employee._id,
        name: employee.name,
        employeeId: employee.employeeId,
        jobRole: employee.jobRole,
        department: employee.department,
        phone: employee.phone,
        email: employee.email,
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
 * @desc    Get list of all employees with optional filters
 * @access  Admin only
 */
router.get('/employees', async (req, res) => {
  try {
    const { department, search, limit, page } = req.query;

    // Build query
    let query = {};
    
    if (department) {
      query.department = department;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { jobRole: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Fetch employees
    const employees = await Employee.find(query)
      .select('-fingerprintTemplate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Employee.countDocuments(query);

    res.json({
      success: true,
      count: employees.length,
      total: total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
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
      .select('-fingerprintTemplate');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Get attendance statistics
    const attendanceRecords = await Attendance.find({ 
      employeeId: employee.employeeId 
    });

    const stats = {
      totalRecords: attendanceRecords.length,
      present: attendanceRecords.filter(r => r.status === 'PRESENT').length,
      absent: attendanceRecords.filter(r => r.status === 'ABSENT').length,
      late: attendanceRecords.filter(r => r.status === 'LATE').length,
      halfDay: attendanceRecords.filter(r => r.status === 'HALF_DAY').length,
    };

    stats.attendanceRate = stats.totalRecords > 0 
      ? ((stats.present / stats.totalRecords) * 100).toFixed(2) 
      : 0;

    res.json({
      success: true,
      employee: employee,
      statistics: stats,
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
 * @route   PUT /api/admin/employees/:id
 * @desc    Update employee details
 * @access  Admin only
 */
router.put('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      jobRole,
      department,
      phone,
      email,
      baseLocation,
      fingerprintTemplate,
    } = req.body;

    // Find employee
    const employee = await Employee.findById(id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Update fields if provided
    if (name) employee.name = name;
    if (jobRole) employee.jobRole = jobRole;
    if (department) employee.department = department;
    if (phone) employee.phone = phone;
    if (email) employee.email = email;
    if (fingerprintTemplate) employee.fingerprintTemplate = fingerprintTemplate;
    
    if (baseLocation && baseLocation.latitude && baseLocation.longitude) {
      employee.baseLocation = {
        latitude: baseLocation.latitude,
        longitude: baseLocation.longitude,
      };
    }

    await employee.save();

    res.json({
      success: true,
      message: 'Employee updated successfully',
      employee: {
        _id: employee._id,
        name: employee.name,
        employeeId: employee.employeeId,
        jobRole: employee.jobRole,
        department: employee.department,
        phone: employee.phone,
        email: employee.email,
        baseLocation: employee.baseLocation,
        updatedAt: employee.updatedAt,
      },
    });

  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating employee',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/admin/employees/:id
 * @desc    Delete an employee
 * @access  Admin only
 */
router.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Check if employee has attendance records
    const attendanceCount = await Attendance.countDocuments({ 
      employeeId: employee.employeeId 
    });

    // Delete employee
    await Employee.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Employee deleted successfully',
      deletedEmployee: {
        employeeId: employee.employeeId,
        name: employee.name,
        attendanceRecordsCount: attendanceCount,
      },
      note: attendanceCount > 0 
        ? `${attendanceCount} attendance records still exist for this employee in the database`
        : 'No attendance records found for this employee',
    });

  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting employee',
      error: error.message,
    });
  }
});

// ============================================
// ATTENDANCE MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/admin/attendance/mark
 * @desc    Mark attendance for an employee
 * @access  Admin only
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

    // Validate status
    const validStatuses = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Find employee
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

    // Check if attendance already marked
    const startOfDay = new Date(attendanceDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(attendanceDate.setHours(23, 59, 59, 999));

    const existingAttendance = await Attendance.findOne({
      employeeId: employeeId,
      date: { $gte: startOfDay, $lt: endOfDay },
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
    const attendance = new Attendance({
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      jobRole: employee.jobRole,
      date: attendanceDate,
      status: status,
      fingerprintTemplate: employee.fingerprintTemplate,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      markedBy: req.user.username,
    });

    await attendance.save();

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      attendance: {
        _id: attendance._id,
        employeeId: attendance.employeeId,
        employeeName: attendance.employeeName,
        department: attendance.department,
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
    const { startDate, endDate, limit = 100 } = req.query;

    let query = { employeeId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const attendanceRecords = await Attendance.find(query)
      .select('-fingerprintTemplate')
      .sort({ date: -1 })
      .limit(parseInt(limit));

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
 * @route   PUT /api/admin/attendance/:id
 * @desc    Update attendance record
 * @access  Admin only
 */
router.put('/attendance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const attendance = await Attendance.findById(id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    const oldStatus = attendance.status;
    attendance.status = status;
    await attendance.save();

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      attendance: {
        _id: attendance._id,
        employeeId: attendance.employeeId,
        employeeName: attendance.employeeName,
        date: attendance.date,
        oldStatus: oldStatus,
        newStatus: attendance.status,
        updatedAt: attendance.updatedAt,
      },
    });

  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating attendance',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/admin/attendance/:id
 * @desc    Delete attendance record
 * @access  Admin only
 */
router.delete('/attendance/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    await Attendance.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Attendance record deleted successfully',
      deletedAttendance: {
        _id: attendance._id,
        employeeId: attendance.employeeId,
        employeeName: attendance.employeeName,
        date: attendance.date,
        status: attendance.status,
      },
    });

  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting attendance',
      error: error.message,
    });
  }
});

// ============================================
// DASHBOARD & ANALYTICS ROUTES
// ============================================

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get comprehensive dashboard statistics
 * @access  Admin only
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Total employees
    const totalEmployees = await Employee.countDocuments();

    // Today's attendance stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow }
    });

    const todayPresent = todayAttendance.filter(a => a.status === 'PRESENT').length;
    const todayAbsent = todayAttendance.filter(a => a.status === 'ABSENT').length;
    const todayLate = todayAttendance.filter(a => a.status === 'LATE').length;
    const todayHalfDay = todayAttendance.filter(a => a.status === 'HALF_DAY').length;
    const todayNotMarked = totalEmployees - todayAttendance.length;

    // This month's stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const monthlyAttendance = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd }
    });

    const monthlyPresent = monthlyAttendance.filter(a => a.status === 'PRESENT').length;
    const monthlyAbsent = monthlyAttendance.filter(a => a.status === 'ABSENT').length;
    const monthlyLate = monthlyAttendance.filter(a => a.status === 'LATE').length;
    const monthlyHalfDay = monthlyAttendance.filter(a => a.status === 'HALF_DAY').length;

    // Department-wise stats
    const departments = await Employee.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      }
    ]);

    const departmentStats = [];
    for (const dept of departments) {
      const deptEmployees = dept.count;
      const deptAttendance = todayAttendance.filter(
        a => a.department === dept._id
      );
      const deptPresent = deptAttendance.filter(a => a.status === 'PRESENT').length;

      departmentStats.push({
        department: dept._id,
        totalEmployees: deptEmployees,
        presentToday: deptPresent,
        absentToday: deptEmployees - deptPresent,
        attendanceRate: deptEmployees > 0 
          ? ((deptPresent / deptEmployees) * 100).toFixed(2) 
          : 0
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
          attendanceRate: totalEmployees > 0 
            ? ((todayPresent / totalEmployees) * 100).toFixed(2) 
            : 0
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
      error: error.message,
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
 * @desc    Get complete attendance history for a specific employee with stats
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
      error: error.message,
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
    const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    // Get all attendance for the month
    const attendanceRecords = await Attendance.find({
      date: { $gte: monthStart, $lte: monthEnd }
    }).sort({ date: 1 });

    // Group by date
    const dateWiseAttendance = {};
    attendanceRecords.forEach(record => {
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
      dateWiseAttendance[dateKey][record.status.toLowerCase()] = 
        (dateWiseAttendance[dateKey][record.status.toLowerCase()] || 0) + 1;
      dateWiseAttendance[dateKey].total++;
    });

    const dailyBreakdown = Object.values(dateWiseAttendance);

    // Overall month statistics
    const totalPresent = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const totalAbsent = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const totalLate = attendanceRecords.filter(r => r.status === 'LATE').length;
    const totalHalfDay = attendanceRecords.filter(r => r.status === 'HALF_DAY').length;

    res.json({
      success: true,
      period: {
        month: monthStart.toLocaleString('default', { month: 'long' }),
        year: targetYear,
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString()
      },
      summary: {
        totalRecords: attendanceRecords.length,
        present: totalPresent,
        absent: totalAbsent,
        late: totalLate,
        halfDay: totalHalfDay,
        attendanceRate: attendanceRecords.length > 0 
          ? ((totalPresent / attendanceRecords.length) * 100).toFixed(2) 
          : 0
      },
      dailyBreakdown
    });

  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly report',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/admin/dashboard/department-wise
 * @desc    Get department-wise attendance statistics
 * @access  Admin only
 */
router.get('/dashboard/department-wise', async (req, res) => {
  try {
    const { date } = req.query;
    
    let targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all departments
    const departments = await Employee.aggregate([
      {
        $group: {
          _id: '$department',
          totalEmployees: { $sum: 1 }
        }
      }
    ]);

    // Get attendance for the target date
    const attendanceRecords = await Attendance.find({
      date: { $gte: targetDate, $lt: nextDay }
    });

    // Calculate stats for each department
    const departmentStats = departments.map(dept => {
      const deptAttendance = attendanceRecords.filter(
        a => a.department === dept._id
      );

      const present = deptAttendance.filter(a => a.status === 'PRESENT').length;
      const absent = deptAttendance.filter(a => a.status === 'ABSENT').length;
      const late = deptAttendance.filter(a => a.status === 'LATE').length;
      const halfDay = deptAttendance.filter(a => a.status === 'HALF_DAY').length;
      const notMarked = dept.totalEmployees - deptAttendance.length;

      return {
        department: dept._id,
        totalEmployees: dept.totalEmployees,
        present,
        absent,
        late,
        halfDay,
        notMarked,
        attendanceRate: dept.totalEmployees > 0 
          ? ((present / dept.totalEmployees) * 100).toFixed(2) 
          : 0
      };
    });

    res.json({
      success: true,
      date: targetDate.toISOString(),
      departments: departmentStats
    });

  } catch (error) {
    console.error('Error fetching department-wise stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching department-wise statistics',
      error: error.message,
    });
  }
});

module.exports = router;
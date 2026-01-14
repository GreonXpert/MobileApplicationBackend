// scripts/cleanupTestEmployees.js
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Fingerprint = require('../models/fingerprint');

async function cleanupTestData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Delete test employees
    const testEmployeeIds = ['EMP001', 'EMP002', 'EMP003'];
    
    console.log('\n🗑️  Deleting test employees...');
    for (const empId of testEmployeeIds) {
      // Delete employee
      const employee = await Employee.findOneAndDelete({ employeeId: empId });
      if (employee) {
        console.log(`   ✓ Deleted employee: ${empId}`);
      }

      // Delete their attendance records
      const attendanceResult = await Attendance.deleteMany({ employeeId: empId });
      if (attendanceResult.deletedCount > 0) {
        console.log(`   ✓ Deleted ${attendanceResult.deletedCount} attendance records for ${empId}`);
      }

      // Delete their fingerprints
      const fingerprintResult = await Fingerprint.deleteMany({ employeeId: empId });
      if (fingerprintResult.deletedCount > 0) {
        console.log(`   ✓ Deleted ${fingerprintResult.deletedCount} fingerprint records for ${empId}`);
      }
    }

    // Show final count
    const remainingEmployees = await Employee.countDocuments();
    const remainingAttendance = await Attendance.countDocuments();
    const remainingFingerprints = await Fingerprint.countDocuments();

    console.log('\n📊 Database Summary:');
    console.log(`   Employees: ${remainingEmployees}`);
    console.log(`   Attendance Records: ${remainingAttendance}`);
    console.log(`   Fingerprints: ${remainingFingerprints}`);

    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupTestData();
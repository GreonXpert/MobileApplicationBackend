const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Adjust path to your User model

/**
 * Seeds admin and super admin users if they don't exist
 * Uses environment variables for credentials (more secure)
 * This should be called when the server starts
 */
const seedAdminUsers = async () => {
  try {
    console.log('🌱 Checking for admin users...');

    // Super Admin configuration from environment variables
    const superAdminData = {
      name: process.env.SUPERADMIN_NAME || 'Super Admin',
      email: process.env.SUPERADMIN_EMAIL || 'superadmin@greonxpert.com',
      password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123',
      role: 'superadmin',
      phone: process.env.SUPERADMIN_PHONE || '+1234567890',
      isActive: true,
      isVerified: true
    };

    // Admin configuration from environment variables
    const adminData = {
      name: process.env.ADMIN_NAME || 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@greonxpert.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      phone: process.env.ADMIN_PHONE || '+1234567891',
      isActive: true,
      isVerified: true
    };

    // Warning if using default passwords
    if (!process.env.SUPERADMIN_PASSWORD || !process.env.ADMIN_PASSWORD) {
      console.warn('⚠️  WARNING: Using default passwords! Please set SUPERADMIN_PASSWORD and ADMIN_PASSWORD in .env file');
    }

    // Check if Super Admin exists
    const existingSuperAdmin = await User.findOne({ 
      $or: [
        { role: 'superadmin' },
        { email: superAdminData.email }
      ]
    });

    if (!existingSuperAdmin) {
      // Hash password
      const hashedPassword = await bcrypt.hash(superAdminData.password, 10);
      
      // Create Super Admin
      const superAdmin = new User({
        ...superAdminData,
        password: hashedPassword
      });

      await superAdmin.save();
      console.log('✅ Super Admin created successfully');
      console.log(`   Email: ${superAdminData.email}`);
      console.log(`   Role: ${superAdminData.role}`);
      if (!process.env.SUPERADMIN_PASSWORD) {
        console.log(`   ⚠️  Default Password: ${superAdminData.password} (CHANGE IMMEDIATELY)`);
      }
    } else {
      console.log('ℹ️  Super Admin already exists');
    }

    // Check if Admin exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: adminData.email },
        { role: 'admin', email: adminData.email }
      ]
    });

    if (!existingAdmin) {
      // Hash password
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      
      // Create Admin
      const admin = new User({
        ...adminData,
        password: hashedPassword
      });

      await admin.save();
      console.log('✅ Admin created successfully');
      console.log(`   Email: ${adminData.email}`);
      console.log(`   Role: ${adminData.role}`);
      if (!process.env.ADMIN_PASSWORD) {
        console.log(`   ⚠️  Default Password: ${adminData.password} (CHANGE IMMEDIATELY)`);
      }
    } else {
      console.log('ℹ️  Admin already exists');
    }

    console.log('🎉 Admin users seeding completed\n');

  } catch (error) {
    console.error('❌ Error seeding admin users:', error.message);
    // Don't throw error - allow server to continue starting
    // throw error;
  }
};

module.exports = seedAdminUsers;
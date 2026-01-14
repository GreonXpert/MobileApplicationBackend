// scripts/migrateFingerprintsToEncrypted.js
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Fingerprint = require('../models/fingerprint');

async function migrateFingerprints() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all employees
    const employees = await Employee.find({});
    console.log(`📊 Found ${employees.length} employees`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const employee of employees) {
      try {
        // Check if fingerprint already exists
        const existing = await Fingerprint.findOne({
          employeeId: employee.employeeId,
          status: 'ACTIVE',
        });

        if (existing) {
          console.log(`⏭️  Skipping ${employee.employeeId} - already has encrypted fingerprint`);
          skipped++;
          continue;
        }

        // Create new encrypted fingerprint
        const fingerprint = new Fingerprint({
          employee: employee._id,
          employeeId: employee.employeeId,
          fingerIndex: 1,
          fingerName: 'RIGHT_INDEX',
          format: 'ISO_19794_2',
          enrolledBy: 'migration_script',
        });

        fingerprint.setTemplate(employee.fingerprintTemplate);
        await fingerprint.save();

        console.log(`✅ Migrated ${employee.employeeId}`);
        migrated++;

      } catch (error) {
        console.error(`❌ Failed to migrate ${employee.employeeId}:`, error.message);
        failed++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateFingerprints();
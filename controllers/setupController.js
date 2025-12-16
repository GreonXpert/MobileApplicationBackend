// controllers/setupController.js
const User = require('../models/User');

/**
 * Creates/updates initial Superadmin and Admin users from .env at server start.
 * - If user doesn't exist -> create
 * - If user exists -> update name/phone/isActive (password updates only if changed)
 */
async function ensureInitialUsers() {
  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!superadminEmail || !adminEmail) {
    console.warn('⚠️ SUPERADMIN_EMAIL / ADMIN_EMAIL not found in .env. Skipping initial user setup.');
    return;
  }

  // Helper: derive a stable username from email if you don't store username in env
  const usernameFromEmail = (email) => String(email).split('@')[0].toLowerCase();

  // SUPERADMIN from .env :contentReference[oaicite:1]{index=1}
  await upsertUser({
    role: 'superadmin',
    email: superadminEmail,
    username: usernameFromEmail(superadminEmail),
    fullName: process.env.SUPERADMIN_NAME || 'Super Admin',
    phone: process.env.SUPERADMIN_PHONE || '',
    password: process.env.SUPERADMIN_PASSWORD,
  });

  // ADMIN from .env :contentReference[oaicite:2]{index=2}
  await upsertUser({
    role: 'admin',
    email: adminEmail,
    username: usernameFromEmail(adminEmail),
    fullName: process.env.ADMIN_NAME || 'Admin',
    phone: process.env.ADMIN_PHONE || '',
    password: process.env.ADMIN_PASSWORD,
  });

  console.log('✅ Initial users ensured (superadmin/admin).');
}

async function upsertUser({ role, email, username, fullName, phone, password }) {
  if (!password) {
    console.warn(`⚠️ Password missing for ${role} (${email}). Skipping.`);
    return;
  }

  // Find by email (primary)
  let user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Create new
    user = new User({
      role,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      fullName,
      phone,
      password, // will be hashed by pre-save hook :contentReference[oaicite:3]{index=3}
      isActive: true,
    });

    await user.save();
    console.log(`✅ Created ${role}: ${email}`);
    return;
  }

  // Update non-sensitive fields
  user.role = role;
  user.username = username.toLowerCase();
  user.fullName = fullName;
  user.phone = phone;
  user.isActive = true;

  // Only update password if .env password is different from stored hash (comparePassword available) :contentReference[oaicite:4]{index=4}
  const same = await user.comparePassword(password).catch(() => false);
  if (!same) {
    user.password = password; // will re-hash on save
  }

  await user.save();
  console.log(`✅ Updated ${role}: ${email}`);
}

module.exports = { ensureInitialUsers };

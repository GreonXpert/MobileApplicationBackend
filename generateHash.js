// generateHash.js
// Utility script to generate bcrypt password hashes for .env file
// Run this with: node generateHash.js

const bcrypt = require('bcryptjs');

/**
 * Generate a bcrypt hash for a password
 * @param {string} password - The plain text password
 * @returns {Promise<string>} - The bcrypt hash
 */
async function generateHash(password) {
  const saltRounds = 10; // Higher number = more secure but slower
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

// Main execution
async function main() {
  console.log('\n=== Password Hash Generator ===\n');
  
  // Generate hash for Admin password
  const adminPassword = 'admin123'; // Change this to your desired admin password
  const adminHash = await generateHash(adminPassword);
  console.log('Admin Password:', adminPassword);
  console.log('Admin Hash:', adminHash);
  console.log('');
  
  // Generate hash for Superadmin password
  const superadminPassword = 'superadmin123'; // Change this to your desired superadmin password
  const superadminHash = await generateHash(superadminPassword);
  console.log('Superadmin Password:', superadminPassword);
  console.log('Superadmin Hash:', superadminHash);
  console.log('');
  
  console.log('Copy these hashes to your .env file\n');
}

main();

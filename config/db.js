// config/db.js
const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas
 * This function establishes connection to MongoDB using the URI from .env
 */
const connectDB = async () => {
  try {
    // Connect to MongoDB with recommended options
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;

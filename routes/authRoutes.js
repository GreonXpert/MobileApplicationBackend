// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login for Admin or Superadmin
 * @access  Public
 * 
 * This endpoint authenticates users (Admin or Superadmin) against
 * credentials configured in the .env file.
 * 
 * Body: { username: string, password: string }
 * Returns: { success: boolean, token: string, user: object }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    // Check if credentials match Admin (from .env)
    if (username === process.env.ADMIN_USERNAME) {
      const isValidPassword = await bcrypt.compare(
        password,
        process.env.ADMIN_PASSWORD_HASH
      );

      if (isValidPassword) {
        // Generate JWT token
        const token = jwt.sign(
          {
            username: username,
            role: 'ADMIN',
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' } // Token expires in 24 hours
        );

        return res.json({
          success: true,
          message: 'Login successful',
          token: token,
          user: {
            username: username,
            role: 'ADMIN',
          },
        });
      }
    }

    // Check if credentials match Superadmin (from .env)
    if (username === process.env.SUPERADMIN_USERNAME) {
      const isValidPassword = await bcrypt.compare(
        password,
        process.env.SUPERADMIN_PASSWORD_HASH
      );

      if (isValidPassword) {
        // Generate JWT token
        const token = jwt.sign(
          {
            username: username,
            role: 'SUPERADMIN',
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' } // Token expires in 24 hours
        );

        return res.json({
          success: true,
          message: 'Login successful',
          token: token,
          user: {
            username: username,
            role: 'SUPERADMIN',
          },
        });
      }
    }

    // If we reach here, credentials are invalid
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password.',
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify if token is valid
 * @access  Public (but requires token)
 */
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      success: true,
      user: decoded,
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid token',
    });
  }
});

module.exports = router;

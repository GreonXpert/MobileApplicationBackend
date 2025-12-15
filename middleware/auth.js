// middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate JWT token
 * Verifies the token and attaches user information to the request object
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  // Expected format: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token after "Bearer "

  // If no token is provided
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    // Verify token using JWT_SECRET from .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user information to request object
    // This makes user data available in route handlers
    req.user = decoded;
    
    // Continue to next middleware or route handler
    next();
  } catch (error) {
    // Token is invalid or expired
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};

/**
 * Middleware to check if user has ADMIN role
 * Must be used after authenticateToken middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireAdmin = (req, res, next) => {
  // Check if user object exists (should be set by authenticateToken)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  // Check if user has ADMIN role
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }

  // User is an admin, continue
  next();
};

/**
 * Middleware to check if user has SUPERADMIN role
 * Must be used after authenticateToken middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireSuperadmin = (req, res, next) => {
  // Check if user object exists (should be set by authenticateToken)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  // Check if user has SUPERADMIN role
  if (req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Superadmin privileges required.',
    });
  }

  // User is a superadmin, continue
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperadmin,
};

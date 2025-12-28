// routes/fingerprintRoutes.js
const express = require('express');
const router = express.Router();
const Fingerprint = require('../models/fingerprint');
const Employee = require('../models/Employee');
const { protect, authorize } = require('../middleware/auth');

/**
 * Fingerprint Management Routes
 * 
 * All routes require authentication (JWT token)
 * Most routes require admin or superadmin role
 * 
 * Base path: /api/fingerprints
 */

// ============================================
// MIDDLEWARE: All routes require authentication
// ============================================

router.use(protect);

// ============================================
// @route   POST /api/fingerprints/enroll
// @desc    Enroll a new fingerprint template
// @access  Admin only
// ============================================

router.post('/enroll', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const {
      employeeId,
      templateBase64,
      format,
      fingerIndex,
      fingerName,
      quality,
      deviceInfo,
    } = req.body;

    // ============================================
    // VALIDATION
    // ============================================

    // Required fields
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required',
      });
    }

    if (!templateBase64) {
      return res.status(400).json({
        success: false,
        message: 'templateBase64 is required',
      });
    }

    // Validate format
    const validFormats = ['ISO_19794_2', 'ISO_19794_4', 'ANSI_378', 'PROPRIETARY'];
    if (format && !validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
      });
    }

    // Validate fingerIndex (0-9 or null)
    if (fingerIndex !== undefined && fingerIndex !== null) {
      const idx = parseInt(fingerIndex);
      if (isNaN(idx) || idx < 0 || idx > 9) {
        return res.status(400).json({
          success: false,
          message: 'fingerIndex must be between 0 and 9',
        });
      }
    }

    // Validate quality (0-100 or null)
    if (quality !== undefined && quality !== null) {
      const q = parseInt(quality);
      if (isNaN(q) || q < 0 || q > 100) {
        return res.status(400).json({
          success: false,
          message: 'quality must be between 0 and 100',
        });
      }
    }

    // ============================================
    // CHECK: Employee exists
    // ============================================

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee ${employeeId} not found`,
      });
    }

    // ============================================
    // DECODE AND VALIDATE TEMPLATE
    // ============================================

    let templateBuffer;
    try {
      templateBuffer = Buffer.from(templateBase64, 'base64');
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Base64 template data',
      });
    }

    // Basic size validation (templates typically 500 bytes to 4KB, allow up to 10MB)
    if (templateBuffer.length === 0 || templateBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Template size must be between 1 byte and 10MB',
      });
    }

    // ============================================
    // CREATE FINGERPRINT DOCUMENT
    // ============================================

    const fingerprint = new Fingerprint({
      employee: employee._id,
      employeeId: employee.employeeId,
      fingerIndex: fingerIndex !== undefined ? parseInt(fingerIndex) : undefined,
      fingerName: fingerName || 'UNKNOWN',
      format: format || 'ISO_19794_2',
      quality: quality !== undefined ? parseInt(quality) : undefined,
      device: deviceInfo || {
        vendor: 'Mantra',
        model: 'MFS110',
      },
      enrolledBy: req.user.username,
    });

    // Set template (automatically encrypts and hashes)
    try {
      const templateInfo = fingerprint.setTemplate(templateBuffer);
      
      console.log('[Fingerprint Enroll] Template info:', {
        employeeId,
        originalSize: templateInfo.originalSize,
        encryptedSize: templateInfo.encryptedSize,
        hash: templateInfo.templateHash.substring(0, 16) + '...',
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Template processing failed: ${error.message}`,
      });
    }

    // ============================================
    // CHECK: Duplicate template
    // ============================================

    const isDuplicate = await Fingerprint.templateExists(fingerprint.templateHash);
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'This fingerprint template is already enrolled (duplicate detected)',
      });
    }

    // ============================================
    // SAVE TO DATABASE
    // ============================================

    await fingerprint.save();

    // ============================================
    // RESPONSE
    // ============================================

    res.status(201).json({
      success: true,
      message: 'Fingerprint enrolled successfully',
      fingerprint: {
        _id: fingerprint._id,
        employeeId: fingerprint.employeeId,
        fingerIndex: fingerprint.fingerIndex,
        fingerName: fingerprint.fingerName,
        format: fingerprint.format,
        quality: fingerprint.quality,
        status: fingerprint.status,
        enrolledBy: fingerprint.enrolledBy,
        enrolledAt: fingerprint.enrolledAt,
        createdAt: fingerprint.createdAt,
      },
    });

  } catch (error) {
    console.error('[Fingerprint Enroll Error]:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate fingerprint template detected',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during fingerprint enrollment',
      error: error.message,
    });
  }
});

// ============================================
// @route   GET /api/fingerprints/:employeeId
// @desc    Get all fingerprint templates for an employee
// @access  Admin only
// ============================================

router.get('/:employeeId', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Find all fingerprints for this employee
    const fingerprints = await Fingerprint.find({ employeeId })
      .select('-encryptedTemplate') // Don't send encrypted data
      .sort({ createdAt: -1 });

    // Get employee info
    const employee = await Employee.findOne({ employeeId })
      .select('name employeeId department jobRole');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee ${employeeId} not found`,
      });
    }

    res.json({
      success: true,
      employee: {
        name: employee.name,
        employeeId: employee.employeeId,
        department: employee.department,
        jobRole: employee.jobRole,
      },
      fingerprints: fingerprints.map(fp => ({
        _id: fp._id,
        fingerIndex: fp.fingerIndex,
        fingerName: fp.fingerName,
        format: fp.format,
        quality: fp.quality,
        status: fp.status,
        enrolledBy: fp.enrolledBy,
        enrolledAt: fp.enrolledAt,
        lastVerifiedAt: fp.lastVerifiedAt,
        verificationCount: fp.verificationCount,
        device: fp.device,
      })),
      count: fingerprints.length,
    });

  } catch (error) {
    console.error('[Get Fingerprints Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching fingerprints',
      error: error.message,
    });
  }
});

// ============================================
// @route   GET /api/fingerprints/template/:id
// @desc    Get decrypted template by fingerprint ID
// @access  Admin only (use with extreme caution!)
// ============================================

router.get('/template/:id', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;

    const fingerprint = await Fingerprint.findById(id);

    if (!fingerprint) {
      return res.status(404).json({
        success: false,
        message: 'Fingerprint not found',
      });
    }

    // Check if active
    if (fingerprint.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Cannot retrieve template: status is ${fingerprint.status}`,
      });
    }

    // Decrypt and return template
    try {
      const templateBase64 = fingerprint.getTemplateBase64();

      // Log access for audit
      console.log(`[AUDIT] Template accessed: Fingerprint ${id}, Employee ${fingerprint.employeeId}, By: ${req.user.username}`);

      res.json({
        success: true,
        fingerprint: {
          _id: fingerprint._id,
          employeeId: fingerprint.employeeId,
          fingerIndex: fingerprint.fingerIndex,
          format: fingerprint.format,
        },
        template: templateBase64,
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt template',
      });
    }

  } catch (error) {
    console.error('[Get Template Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving template',
      error: error.message,
    });
  }
});

// ============================================
// @route   DELETE /api/fingerprints/:id
// @desc    Delete (revoke) a fingerprint template
// @access  Admin only
// ============================================

router.delete('/:id', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const fingerprint = await Fingerprint.findById(id);

    if (!fingerprint) {
      return res.status(404).json({
        success: false,
        message: 'Fingerprint not found',
      });
    }

    // Soft delete: Revoke instead of hard delete
    fingerprint.revoke(req.user.username, reason);
    await fingerprint.save();

    console.log(`[Fingerprint Revoked] ID: ${id}, Employee: ${fingerprint.employeeId}, By: ${req.user.username}`);

    res.json({
      success: true,
      message: 'Fingerprint revoked successfully',
      fingerprint: {
        _id: fingerprint._id,
        employeeId: fingerprint.employeeId,
        status: fingerprint.status,
        revokedAt: fingerprint.revokedAt,
        revokedBy: fingerprint.revokedBy,
        revokeReason: fingerprint.revokeReason,
      },
    });

  } catch (error) {
    console.error('[Delete Fingerprint Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting fingerprint',
      error: error.message,
    });
  }
});

// ============================================
// @route   GET /api/fingerprints/list/all
// @desc    Get all fingerprints (admin overview)
// @access  Superadmin only
// ============================================

router.get('/list/all', authorize('superadmin'), async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status.toUpperCase();
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const fingerprints = await Fingerprint.find(query)
      .select('-encryptedTemplate')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('employee', 'name employeeId department');

    const total = await Fingerprint.countDocuments(query);

    res.json({
      success: true,
      fingerprints: fingerprints.map(fp => ({
        _id: fp._id,
        employee: fp.employee,
        employeeId: fp.employeeId,
        fingerIndex: fp.fingerIndex,
        fingerName: fp.fingerName,
        format: fp.format,
        quality: fp.quality,
        status: fp.status,
        enrolledBy: fp.enrolledBy,
        enrolledAt: fp.enrolledAt,
        device: fp.device,
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error('[List All Fingerprints Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error listing fingerprints',
      error: error.message,
    });
  }
});

// ============================================
// @route   POST /api/fingerprints/verify (OPTIONAL)
// @desc    Verify a live fingerprint against stored template
// @access  Admin only
// 
// NOTE: This is a PLACEHOLDER. Real verification requires:
// - Matching algorithm (SDK-specific or third-party library)
// - MFS110 doesn't provide server-side matching
// - Consider device-side matching instead
// ============================================

router.post('/verify', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { employeeId, probeTemplateBase64, format } = req.body;

    // This is a PLACEHOLDER implementation
    // In production, you would:
    // 1. Use Mantra's matching library (if available for Node.js)
    // 2. Use a third-party biometric matching library
    // 3. OR implement device-side matching (capture on device, match on device, send result)

    res.status(501).json({
      success: false,
      message: 'Server-side verification not implemented',
      note: 'MFS110 RDService does not provide server-side matching. Consider device-side verification.',
      alternativeApproach: 'Capture probe template on device, compare with stored templates on device, send match result to server.',
    });

  } catch (error) {
    console.error('[Verify Fingerprint Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification',
      error: error.message,
    });
  }
});

module.exports = router;
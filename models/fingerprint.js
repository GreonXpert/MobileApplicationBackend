// models/Fingerprint.js
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Fingerprint Template Schema
 * 
 * Stores biometric fingerprint templates from MFS110 L1 RDService.
 * Implements security best practices:
 * - Application-level encryption (AES-256-GCM)
 * - Template hash for deduplication
 * - Comprehensive audit trail
 * - ISO format compliance
 * 
 * ⚠️ IMPORTANT SECURITY NOTES:
 * - Templates are encrypted before storage
 * - Never log or expose raw template data
 * - Require explicit consent for biometric capture
 * - Implement data retention policies
 */

const fingerprintSchema = new mongoose.Schema({
  // Reference to Employee
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee reference is required'],
    index: true,
  },
  
  // Denormalized employeeId for quick queries
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    index: true,
  },
  
  // Finger position (optional but recommended)
  fingerIndex: {
    type: Number,
    min: 0,
    max: 9,
    // 0-4: Right hand (thumb to pinky)
    // 5-9: Left hand (thumb to pinky)
    // Can be null if position unknown
  },
  
  fingerName: {
    type: String,
    enum: [
      'RIGHT_THUMB', 'RIGHT_INDEX', 'RIGHT_MIDDLE', 'RIGHT_RING', 'RIGHT_PINKY',
      'LEFT_THUMB', 'LEFT_INDEX', 'LEFT_MIDDLE', 'LEFT_RING', 'LEFT_PINKY',
      'UNKNOWN'
    ],
    default: 'UNKNOWN',
  },
  
  // Template Format
  format: {
    type: String,
    enum: ['ISO_19794_2', 'ISO_19794_4', 'ANSI_378', 'PROPRIETARY'],
    required: [true, 'Template format is required'],
    default: 'ISO_19794_2',
  },
  
  /**
   * Encrypted Template Data
   * Stored as Buffer (binary data)
   * 
   * Encryption: AES-256-GCM
   * Structure: iv (16 bytes) + authTag (16 bytes) + encrypted data
   */
  encryptedTemplate: {
    type: Buffer,
    required: [true, 'Encrypted template is required'],
    // Max size check (templates typically 500 bytes to 4KB)
    validate: {
      validator: function(v) {
        return v && v.length > 0 && v.length <= 10 * 1024 * 1024; // Max 10MB
      },
      message: 'Template must be between 1 byte and 10MB'
    }
  },
  
  /**
   * Template Hash (SHA-256)
   * Used for:
   * - Deduplication (prevent same template enrolled twice)
   * - Integrity verification
   * - Quick comparisons
   */
  templateHash: {
    type: String,
    required: [true, 'Template hash is required'],
    unique: true, // Prevent duplicate templates
    index: true,
  },
  
  // Quality Score (0-100, higher is better)
  quality: {
    type: Number,
    min: 0,
    max: 100,
    // Quality score from scanner, if available
  },
  
  // Device Information
  device: {
    vendor: {
      type: String,
      default: 'Mantra',
    },
    model: {
      type: String,
      default: 'MFS110',
    },
    serialNumber: String,
    rdServiceVersion: String,
  },
  
  // Enrollment Metadata
  enrolledBy: {
    type: String, // Admin username
    required: [true, 'Enrolled by is required'],
  },
  
  enrolledAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
    default: 'ACTIVE',
    index: true,
  },
  
  revokedAt: Date,
  revokedBy: String,
  revokeReason: String,
  
  // Audit Trail
  lastVerifiedAt: Date,
  verificationCount: {
    type: Number,
    default: 0,
  },
  
}, {
  timestamps: true, // createdAt, updatedAt
});

// ============================================
// INDEXES
// ============================================

// Compound indexes for common queries
fingerprintSchema.index({ employeeId: 1, status: 1 });
fingerprintSchema.index({ employeeId: 1, fingerIndex: 1 });
fingerprintSchema.index({ status: 1, createdAt: -1 });

// ============================================
// ENCRYPTION UTILITIES
// ============================================

/**
 * Encryption key management
 * ⚠️ PRODUCTION: Store this in environment variable or key management service (KMS)
 */
const ENCRYPTION_KEY = process.env.FINGERPRINT_ENCRYPTION_KEY || 
  crypto.randomBytes(32); // 256-bit key

if (!process.env.FINGERPRINT_ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: Using default encryption key. Set FINGERPRINT_ENCRYPTION_KEY in production!');
}

/**
 * Encrypt template data
 * Algorithm: AES-256-GCM (Galois/Counter Mode)
 * 
 * @param {Buffer} plaintext - Raw template bytes
 * @returns {Buffer} - Concatenated buffer: [iv(16) + authTag(16) + ciphertext]
 */
function encryptTemplate(plaintext) {
  const iv = crypto.randomBytes(16); // 128-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag
  
  // Combine: iv + authTag + ciphertext
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypt template data
 * 
 * @param {Buffer} encrypted - Encrypted buffer from database
 * @returns {Buffer} - Decrypted template bytes
 */
function decryptTemplate(encrypted) {
  const iv = encrypted.slice(0, 16);
  const authTag = encrypted.slice(16, 32);
  const ciphertext = encrypted.slice(32);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
}

/**
 * Generate SHA-256 hash of template
 * 
 * @param {Buffer} templateBuffer - Raw template bytes
 * @returns {string} - Hex-encoded hash
 */
function hashTemplate(templateBuffer) {
  return crypto.createHash('sha256').update(templateBuffer).digest('hex');
}

// ============================================
// SCHEMA METHODS
// ============================================

/**
 * Set template (encrypts and hashes automatically)
 * 
 * @param {Buffer|string} template - Raw template (Buffer or Base64 string)
 * @returns {Object} - { templateHash, encryptedSize }
 */
fingerprintSchema.methods.setTemplate = function(template) {
  // Convert to Buffer if Base64 string
  const templateBuffer = Buffer.isBuffer(template) 
    ? template 
    : Buffer.from(template, 'base64');
  
  // Validate size
  if (templateBuffer.length === 0 || templateBuffer.length > 10 * 1024 * 1024) {
    throw new Error('Template must be between 1 byte and 10MB');
  }
  
  // Generate hash (before encryption)
  this.templateHash = hashTemplate(templateBuffer);
  
  // Encrypt
  this.encryptedTemplate = encryptTemplate(templateBuffer);
  
  return {
    templateHash: this.templateHash,
    encryptedSize: this.encryptedTemplate.length,
    originalSize: templateBuffer.length,
  };
};

/**
 * Get decrypted template
 * ⚠️ Use sparingly! Only for verification purposes.
 * 
 * @returns {Buffer} - Decrypted template bytes
 */
fingerprintSchema.methods.getTemplate = function() {
  if (!this.encryptedTemplate) {
    throw new Error('No template data available');
  }
  
  try {
    return decryptTemplate(this.encryptedTemplate);
  } catch (error) {
    console.error('Template decryption failed:', error);
    throw new Error('Failed to decrypt template');
  }
};

/**
 * Get template as Base64 string
 * 
 * @returns {string} - Base64-encoded template
 */
fingerprintSchema.methods.getTemplateBase64 = function() {
  const decrypted = this.getTemplate();
  return decrypted.toString('base64');
};

/**
 * Revoke template
 * 
 * @param {string} revokedBy - Admin username
 * @param {string} reason - Revocation reason
 */
fingerprintSchema.methods.revoke = function(revokedBy, reason) {
  this.status = 'REVOKED';
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokeReason = reason || 'No reason provided';
};

/**
 * Record verification attempt
 */
fingerprintSchema.methods.recordVerification = function() {
  this.lastVerifiedAt = new Date();
  this.verificationCount += 1;
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find active templates for an employee
 * 
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Array>} - Active fingerprint documents
 */
fingerprintSchema.statics.findActiveByEmployeeId = function(employeeId) {
  return this.find({
    employeeId,
    status: 'ACTIVE'
  }).sort({ createdAt: -1 });
};

/**
 * Check if template already exists (duplicate detection)
 * 
 * @param {string} templateHash - SHA-256 hash of template
 * @returns {Promise<boolean>} - True if template exists
 */
fingerprintSchema.statics.templateExists = async function(templateHash) {
  const count = await this.countDocuments({ 
    templateHash,
    status: 'ACTIVE'
  });
  return count > 0;
};

// ============================================
// SECURITY: Don't expose sensitive data in JSON
// ============================================

fingerprintSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Remove encrypted template from JSON responses
  delete obj.encryptedTemplate;
  
  // Optionally remove template hash in some contexts
  // delete obj.templateHash;
  
  return obj;
};

// ============================================
// AUDIT LOGGING (optional but recommended)
// ============================================

fingerprintSchema.post('save', function(doc) {
  console.log(`[AUDIT] Fingerprint saved: Employee ${doc.employeeId}, Status: ${doc.status}`);
});

fingerprintSchema.post('remove', function(doc) {
  console.log(`[AUDIT] Fingerprint removed: Employee ${doc.employeeId}`);
});

// ============================================
// EXPORT
// ============================================

module.exports = mongoose.model('Fingerprint', fingerprintSchema);

/**
 * USAGE EXAMPLES:
 * 
 * // Create new fingerprint
 * const fp = new Fingerprint({
 *   employee: employeeObjectId,
 *   employeeId: 'EMP001',
 *   fingerIndex: 1,
 *   fingerName: 'RIGHT_INDEX',
 *   format: 'ISO_19794_2',
 *   enrolledBy: 'admin'
 * });
 * 
 * // Set template (automatically encrypts)
 * const base64Template = '...from MFS110...';
 * fp.setTemplate(base64Template);
 * 
 * // Add device info
 * fp.device = {
 *   vendor: 'Mantra',
 *   model: 'MFS110',
 *   rdServiceVersion: '1.4.1'
 * };
 * 
 * await fp.save();
 * 
 * // Later: retrieve and decrypt
 * const saved = await Fingerprint.findById(fpId);
 * const decryptedTemplate = saved.getTemplateBase64();
 */
// utils/fingerprint.js
/**
 * Fingerprint Handling Utilities
 * 
 * This file documents how fingerprint templates from MFS100 / Precision PB100
 * devices should be integrated into this system.
 * 
 * ⚠️ IMPORTANT SDK INTEGRATION NOTES ⚠️
 * 
 * Current Implementation:
 * - fingerprintTemplate is treated as an opaque string
 * - No validation or transformation is performed
 * - Template is stored exactly as received from the device
 * 
 * Real-World Integration Points:
 * 
 * 1. EMPLOYEE REGISTRATION (Frontend - EmployeeCreateScreen):
 *    - Use MFS100/Precision PB100 SDK to capture fingerprint
 *    - SDK will return a template (typically base64 or hex string)
 *    - Send this template as-is to backend API
 *    
 *    Example SDK usage (pseudo-code):
 *    ```
 *    import { MFS100 } from 'mfs100-sdk'; // Or Precision PB100 SDK
 *    
 *    async function captureFingerprint() {
 *      const scanner = new MFS100();
 *      await scanner.initialize();
 *      const result = await scanner.capture();
 *      
 *      if (result.success) {
 *        const template = result.template; // Base64/Hex string
 *        return template;
 *      }
 *    }
 *    ```
 * 
 * 2. TEMPLATE FORMAT:
 *    - MFS100 typically returns ISO 19794-2 format or proprietary format
 *    - Precision PB100 returns ANSI 378 or ISO format
 *    - Template is usually base64-encoded binary data
 *    - Example: "rO0ABXNyABpjb20ubWFudHJhLm1mczEwMC5GaW5nZXJEYXRh..."
 * 
 * 3. TEMPLATE SIZE:
 *    - Typical size: 500 bytes to 4KB
 *    - Stored as String in MongoDB (supports up to 16MB)
 * 
 * 4. SECURITY CONSIDERATIONS:
 *    - Fingerprint templates are biometric data (highly sensitive)
 *    - In production:
 *      * Encrypt templates before storing in database
 *      * Use TLS/SSL for API communication
 *      * Implement access logging for template access
 *      * Consider GDPR/CCPA compliance if applicable
 * 
 * 5. VERIFICATION (Not implemented in this system):
 *    - To verify identity, you would:
 *      a) Capture live fingerprint with SDK
 *      b) Get stored template from database
 *      c) Use SDK's match/verify function
 *      d) SDK returns match score/confidence
 *    
 *    Example verification (pseudo-code):
 *    ```
 *    const liveTemplate = await scanner.capture();
 *    const storedTemplate = employee.fingerprintTemplate;
 *    const matchResult = await scanner.match(liveTemplate, storedTemplate);
 *    
 *    if (matchResult.score > threshold) {
 *      // Verified!
 *    }
 *    ```
 */

/**
 * Validate fingerprint template format (basic check)
 * In production, use SDK-specific validation
 * 
 * @param {string} template - The fingerprint template string
 * @returns {boolean} - Whether template appears valid
 */
function isValidTemplate(template) {
  // Basic validation: check if it's a non-empty string
  if (!template || typeof template !== 'string') {
    return false;
  }

  // Check minimum length (templates are typically >100 characters)
  if (template.length < 50) {
    return false;
  }

  // In production, add SDK-specific validation here
  // For example, check if it's valid base64, has correct header, etc.

  return true;
}

/**
 * Get template metadata (if SDK provides it)
 * This is a placeholder for SDK-specific functionality
 * 
 * @param {string} template - The fingerprint template
 * @returns {Object} - Metadata about the template
 */
function getTemplateInfo(template) {
  return {
    length: template.length,
    type: 'Unknown (SDK-specific)', // Would be detected by SDK
    format: 'Unknown (SDK-specific)', // ISO/ANSI/Proprietary
    quality: 'Unknown (SDK-specific)', // Quality score if available
  };
}

module.exports = {
  isValidTemplate,
  getTemplateInfo,
};

/**
 * INTEGRATION CHECKLIST FOR DEVELOPERS:
 * 
 * □ Install MFS100 or Precision PB100 SDK
 * □ Configure SDK with device drivers
 * □ Test fingerprint capture with SDK
 * □ Implement capture function in mobile app
 * □ Replace manual input with SDK capture
 * □ Test template format compatibility
 * □ Implement error handling for SDK failures
 * □ Test with multiple fingers/users
 * □ Implement template encryption (production)
 * □ Add audit logging for biometric access
 * 
 * SDK Resources:
 * - MFS100: https://www.mantratec.com/
 * - Precision PB100: Contact vendor for SDK documentation
 */

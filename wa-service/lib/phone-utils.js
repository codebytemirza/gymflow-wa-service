// ============================================================
// wa-service/lib/phone-utils.js
// Phone number validation and normalization utilities
// ============================================================

/**
 * Normalize phone number to E.164 format without '+'
 * Examples:
 *   "03001234567" → "923001234567"
 *   "+923001234567" → "923001234567"
 *   "923001234567" → "923001234567"
 *   "+1 (555) 123-4567" → "15551234567"
 *
 * @param {string} phone - Raw phone number
 * @returns {string|null} - Normalized phone or null if invalid
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading + if present (already removed by \D but be explicit)
  cleaned = cleaned.replace(/^\+/, '');

  // Handle Pakistan numbers starting with 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1);
  }

  // Handle numbers with country code already
  if (cleaned.startsWith('92') && cleaned.length === 12) {
    return cleaned;
  }

  // Handle US/Canada numbers (add 1 if missing)
  if (cleaned.length === 10 && !cleaned.startsWith('1')) {
    cleaned = '1' + cleaned;
  }

  // Validate length (E.164 allows 10-15 digits)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {{ valid: boolean, error?: string, normalized?: string }}
 */
export function validatePhone(phone) {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return {
      valid: false,
      error: 'Invalid phone number format. Must be 10-15 digits.',
    };
  }

  // Additional validation for Pakistan numbers
  if (normalized.startsWith('92')) {
    // Pakistan mobile numbers: 923XXXXXXXXX (12 digits total)
    if (normalized.length !== 12) {
      return {
        valid: false,
        error: 'Pakistan numbers must be 12 digits (e.g., 923001234567)',
      };
    }
    // Check if it's a valid mobile prefix (300-399)
    const mobilePrefix = parseInt(normalized.slice(2, 4), 10);
    if (mobilePrefix < 30 || mobilePrefix > 49) {
      return {
        valid: false,
        error: 'Invalid Pakistan mobile number prefix',
      };
    }
  }

  return {
    valid: true,
    normalized,
  };
}

/**
 * Format phone number for display
 * Examples:
 *   "923001234567" → "0300-1234567"
 *   "15551234567" → "+1 (555) 123-4567"
 *
 * @param {string} phone - Normalized phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhoneForDisplay(phone) {
  if (!phone) return '';

  // Pakistan format
  if (phone.startsWith('92') && phone.length === 12) {
    const local = '0' + phone.slice(2);
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }

  // US format
  if (phone.startsWith('1') && phone.length === 11) {
    const local = phone.slice(1);
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  // Generic international format
  return `+${phone}`;
}

/**
 * Convert display format back to E.164
 * @param {string} phone - Display format phone
 * @returns {string|null} - Normalized phone
 */
export function phoneFromDisplay(phone) {
  return normalizePhone(phone);
}

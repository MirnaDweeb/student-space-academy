const crypto = require('crypto');

/**
 * Derives a 32-byte encryption key from environment variable or deterministic dev fallback.
 */
function getEncryptionKey() {
  const secret = process.env.REFUND_DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'egsa_space_academy_default_refund_key_secure_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive text using AES-256-GCM.
 * @param {string} text - Plaintext to encrypt
 * @returns {string} Serialized ciphertext in format iv:authTag:encryptedHex
 */
function encrypt(text) {
  if (!text || typeof text !== 'string') return text;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12-byte IV standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM serialized ciphertext.
 * @param {string} cipherText - Serialized ciphertext iv:authTag:encryptedHex
 * @returns {string} Plaintext
 */
function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return cipherText;
  }
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[ENCRYPTION ERROR] Decryption failed:', err.message);
    return null;
  }
}

/**
 * Masks banking/IBAN identifiers for secure UI display and logging.
 * Never displays full account identifiers.
 * @param {string} identifier - Raw account number or IBAN
 * @param {'IBAN'|'ACCOUNT'} type
 * @returns {string} Masked string (e.g. EG******************1234 or ************1234)
 */
function maskIdentifier(identifier, type = 'IBAN') {
  if (!identifier || typeof identifier !== 'string') return 'N/A';
  const clean = identifier.trim().replace(/\s+/g, '');
  if (clean.length <= 4) return '****';

  const last4 = clean.slice(-4);

  if (type === 'IBAN' && clean.length > 6) {
    const prefix = clean.slice(0, 2).toUpperCase(); // e.g. 'EG'
    const maskLength = clean.length - 6;
    return `${prefix}${'*'.repeat(Math.max(maskLength, 4))}${last4}`;
  }

  const maskLength = clean.length - 4;
  return `${'*'.repeat(Math.max(maskLength, 4))}${last4}`;
}

module.exports = {
  encrypt,
  decrypt,
  encryptSensitiveData: encrypt,
  decryptSensitiveData: decrypt,
  maskIdentifier,
};

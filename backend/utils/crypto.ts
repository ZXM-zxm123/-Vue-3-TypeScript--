import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

let encryptionKey: Buffer | null = null;
let isInitialized = false;

export function initEncryption(masterKey: string): void {
  if (!masterKey || masterKey.length < 32) {
    throw new Error('Encryption master key must be at least 32 characters');
  }

  const salt = crypto.createHash('sha256').update(masterKey).digest();
  encryptionKey = crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
  isInitialized = true;
}

export function isEncryptionReady(): boolean {
  return isInitialized && encryptionKey !== null;
}

export function encrypt(plaintext: string): string {
  if (!isEncryptionReady() || !encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption first.');
  }

  if (!plaintext) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  if (!isEncryptionReady() || !encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption first.');
  }

  if (!encryptedData || !encryptedData.includes(':')) {
    return encryptedData;
  }

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      return encryptedData;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

export function encryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: string[]
): T {
  const result = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      if (typeof result[field] === 'string') {
        result[field] = encrypt(result[field]) as any;
      } else if (typeof result[field] === 'number') {
        result[field] = parseFloat(encrypt(result[field].toString())) as any;
      }
    }
  }

  return result;
}

export function decryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: string[]
): T {
  const result = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      if (typeof result[field] === 'string') {
        try {
          result[field] = decrypt(result[field]) as any;
        } catch {
          // Field might not be encrypted, keep original value
        }
      }
    }
  }

  return result;
}

export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

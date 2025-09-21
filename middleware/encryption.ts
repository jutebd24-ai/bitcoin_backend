import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

// Encrypt sensitive data
export function encryptData(text: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('CryptoStrategy', 'utf8'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted
  };
}

// Decrypt sensitive data
export function decryptData(encryptedData: EncryptedData): string {
  const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
  decipher.setAAD(Buffer.from('CryptoStrategy', 'utf8'));
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Hash sensitive data with salt
export function hashWithSalt(data: string, salt?: string): { hash: string; salt: string } {
  const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha512');
  
  return {
    hash: hash.toString('hex'),
    salt: saltBuffer.toString('hex')
  };
}

// Verify hashed data
export function verifyHash(data: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashWithSalt(data, salt);
  return computedHash === hash;
}

// Generate secure API key
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate secure webhook secret
export function generateWebhookSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Generate secure session token
export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

// Validate webhook signature
export function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  const providedSignature = signature.startsWith('sha256=') 
    ? signature.slice(7) 
    : signature;
    
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Validate CSRF token
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(sessionToken, 'hex')
  );
}

// Secure password hashing (enhanced bcrypt alternative)
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(32);
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
    });
  });
}

// Verify password hash
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.pbkdf2(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

// Rate limit key generation
export function generateRateLimitKey(ip: string, endpoint: string): string {
  return crypto.createHash('sha256').update(`${ip}:${endpoint}`).digest('hex');
}

// Data anonymization for logs
export function anonymizeData(data: any): any {
  const anonymized = JSON.parse(JSON.stringify(data));
  
  // Remove or hash sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'email', 'phone'];
  
  function anonymizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = crypto.createHash('sha256').update(String(obj[key])).digest('hex').substring(0, 8) + '***';
      } else if (typeof obj[key] === 'object') {
        obj[key] = anonymizeObject(obj[key]);
      }
    }
    
    return obj;
  }
  
  return anonymizeObject(anonymized);
}
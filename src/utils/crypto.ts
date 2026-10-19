/**
 * Cryptographic utility for securing IVAC credentials client-side.
 * Uses Web Crypto API:
 * - PBKDF2 with SHA-256 (100,000 iterations) for key derivation from Master PIN.
 * - AES-GCM (256-bit) with a unique 96-bit (12-byte) initialization vector (IV) per encryption.
 * - Unique 128-bit (16-byte) salt per profile.
 * 
 * Guarantees:
 * - No hardcoded encryption keys.
 * - No plaintext passwords written to chrome.storage.local, localStorage, or IndexedDB.
 * - Decryption secret (Master PIN) is NEVER saved to disk or persistent storage.
 */

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface EncryptedCredentialPayload {
  ciphertext: string;
  salt: string;
  iv: string;
}

/**
 * Derive an AES-GCM CryptoKey from a user-supplied Master PIN and salt using PBKDF2
 */
async function deriveKey(masterPin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext password using a user-controlled Master PIN
 */
export async function encryptPassword(
  plaintext: string,
  masterPin: string
): Promise<EncryptedCredentialPayload> {
  if (!plaintext) {
    throw new Error('Password cannot be empty.');
  }
  if (!masterPin || masterPin.length < 4) {
    throw new Error('Master PIN must be at least 4 characters.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPin, salt);

  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts ciphertext using the user-controlled Master PIN
 */
export async function decryptPassword(
  payload: EncryptedCredentialPayload,
  masterPin: string
): Promise<string> {
  if (!masterPin) {
    throw new Error('Master PIN is required to decrypt.');
  }

  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveKey(masterPin, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error('Incorrect Master PIN. Failed to decrypt IVAC password.');
  }
}

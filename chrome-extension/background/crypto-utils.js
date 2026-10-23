/**
 * Web Crypto API (SubtleCrypto) AES-GCM Encryption Utilities
 * Used to securely encrypt and decrypt tokens stored in chrome.storage
 */

let cachedKey = null;

// Helper: Convert ArrayBuffer to Base64
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Retrieve or generate an extension-scoped 256-bit AES-GCM key
 */
async function getOrCreateEncryptionKey() {
  if (cachedKey) return cachedKey;

  try {
    const stored = await chrome.storage.local.get(['_nc_enc_key']);
    if (stored._nc_enc_key) {
      cachedKey = await crypto.subtle.importKey(
        'jwk',
        stored._nc_enc_key,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      return cachedKey;
    }

    // Generate new AES-GCM 256-bit key
    const newKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const exportedJwk = await crypto.subtle.exportKey('jwk', newKey);
    await chrome.storage.local.set({ _nc_enc_key: exportedJwk });

    cachedKey = newKey;
    return cachedKey;
  } catch (err) {
    console.error('Failed to get/create encryption key:', err);
    throw err;
  }
}

/**
 * Encrypt a plaintext token using AES-GCM
 * @param {string} token Plaintext token
 * @returns {Promise<object>} Encrypted object with base64 iv and ciphertext
 */
export async function encryptToken(token) {
  if (!token || typeof token !== 'string') return null;

  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM
  const encoded = new TextEncoder().encode(token);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    v: 1,
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(cipherBuffer)
  };
}

/**
 * Decrypt an encrypted token object using AES-GCM
 * @param {object|string} encryptedData The encrypted token payload
 * @returns {Promise<string|null>} Decrypted token string
 */
export async function decryptToken(encryptedData) {
  if (!encryptedData) return null;

  // Backward compatibility: if already a raw plaintext token (legacy or ghp_...)
  if (typeof encryptedData === 'string') {
    if (encryptedData.startsWith('ghp_') || encryptedData.startsWith('gho_') || encryptedData.startsWith('ghu_')) {
      return encryptedData;
    }
    try {
      encryptedData = JSON.parse(encryptedData);
    } catch {
      return encryptedData;
    }
  }

  if (!encryptedData.iv || !encryptedData.ciphertext) {
    return null;
  }

  try {
    const key = await getOrCreateEncryptionKey();
    const iv = base64ToBuffer(encryptedData.iv);
    const ciphertext = base64ToBuffer(encryptedData.ciphertext);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error('Failed to decrypt token:', err);
    return null;
  }
}

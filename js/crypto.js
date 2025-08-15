(function () {
  async function importKeyFromPassphrase(passphrase) {
    const enc = new TextEncoder();
    return await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
  }

  async function deriveAesGcmKey(p2, saltB64, iterations = 250000) {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const baseKey = await importKeyFromPassphrase(p2);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function b64ToBytes(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }
  function bytesToB64(bytes) {
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  async function decrypt(cipherObj, p2) {
    const { kdf, params, cipher, iv, ciphertext } = cipherObj;
    if (kdf !== 'PBKDF2' || cipher !== 'AES-GCM') throw new Error('Unsupported format');
    const key = await deriveAesGcmKey(p2, params.salt, params.iterations || 250000);
    const ivBytes = b64ToBytes(iv);
    const ctBytes = b64ToBytes(ciphertext);
    const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ctBytes);
    return new TextDecoder().decode(new Uint8Array(ptBuf));
  }

  async function encrypt(plaintext, p2, iterations = 250000) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesGcmKey(p2, bytesToB64(salt), iterations);
    const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    return {
      v: '1',
      kdf: 'PBKDF2',
      params: { iterations, salt: bytesToB64(salt) },
      cipher: 'AES-GCM',
      iv: bytesToB64(iv),
      ciphertext: bytesToB64(new Uint8Array(ctBuf))
    };
  }

  window.CS_Crypto = { encrypt, decrypt };
})(); 
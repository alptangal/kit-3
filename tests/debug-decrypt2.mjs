import { chromium } from 'playwright';

async function testDecrypt() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  const debugInfo = await page.evaluate(async () => {
    try {
      const serverPubRes = await fetch('https://localhost:3003/api/encryption/public-key');
      const serverPubData = await serverPubRes.json();
      console.log('Server pub data:', serverPubData);
      
      if (!serverPubData.data || !serverPubData.data.publicKeyB64) {
        return { error: 'No public key in response' };
      }
      
      const serverPublicKeyB64 = serverPubData.data.publicKeyB64;
      
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      const sessionPublicKey = keyPair.publicKey;
      const sessionPrivateKey = keyPair.privateKey;
      
      const exported = await crypto.subtle.exportKey('spki', sessionPublicKey);
      const sessionPublicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
      
      const serverKeyBytes = Uint8Array.from(atob(serverPublicKeyB64), c => c.charCodeAt(0));
      const serverPublicKey = await crypto.subtle.importKey(
        'spki',
        serverKeyBytes,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
      
      const payload = { username: 'testuser123', publicKeyB64: sessionPublicKeyB64 };
      
      const sessionKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sessionKey,
        new TextEncoder().encode(JSON.stringify(payload))
      );
      
      const rawSessionKey = await crypto.subtle.exportKey('raw', sessionKey);
      const encryptedSessionKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        serverPublicKey,
        rawSessionKey
      );
      
      const encryptedBody = {
        encryptedSessionKeyB64: btoa(String.fromCharCode(...new Uint8Array(encryptedSessionKey))),
        ivB64: btoa(String.fromCharCode(...new Uint8Array(iv))),
        ciphertextB64: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
      };
      
      const res = await fetch('https://localhost:3003/api/register/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(encryptedBody)
      });
      
      const encryptedResponse = await res.json();
      console.log('Encrypted response:', encryptedResponse);
      
      const encryptedSessionKeyBuf = Uint8Array.from(atob(encryptedResponse.encryptedSessionKeyB64), c => c.charCodeAt(0));
      const rawSessionKeyDecrypted = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        sessionPrivateKey,
        encryptedSessionKeyBuf
      );
      
      const decryptedSessionKey = await crypto.subtle.importKey(
        'raw',
        rawSessionKeyDecrypted,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const ivDec = Uint8Array.from(atob(encryptedResponse.ivB64), c => c.charCodeAt(0));
      const ciphertextDec = Uint8Array.from(atob(encryptedResponse.ciphertextB64), c => c.charCodeAt(0));
      
      const plaintextBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivDec },
        decryptedSessionKey,
        ciphertextDec
      );
      
      const decryptedText = new TextDecoder().decode(plaintextBuf);
      console.log('Decrypted text:', decryptedText);
      
      return { success: true, decrypted: JSON.parse(decryptedText) };
    } catch (e) {
      console.log('Error:', e);
      return { success: false, error: e.message, stack: e.stack };
    }
  });
  
  console.log('Debug result:', debugInfo);
  await browser.close();
}

testDecrypt().catch(console.error);

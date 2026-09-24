import { chromium } from 'playwright';

async function testDecrypt() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  // Check if encryptionKeys are available and try to decrypt a response manually
  const debugInfo = await page.evaluate(async () => {
    // Try to access the component's encryptionKeys
    const components = document.querySelectorAll('[data-svelte-h]');
    console.log('Components found:', components.length);
    
    // Try to get the fetchSecure function and test it
    try {
      // Check if we can access the module
      const module = await import('$modules/encryption');
      console.log('Module loaded:', !!module.encryption);
      
      // Get server public key
      const serverPubRes = await fetch('https://localhost:3003/api/encryption/public-key');
      const serverPubData = await serverPubRes.json();
      console.log('Server pub data:', serverPubData);
      
      // Generate a test key pair
      const { publicKey, privateKey } = await module.encryption.generateRSAKeyPair();
      const sessionPublicKeyB64 = await module.encryption.exportKeyToBase64(publicKey, 'spki');
      
      // Make a test request
      const payload = { username: 'testuser123', publicKeyB64: sessionPublicKeyB64 };
      const encryptedBody = await module.encryption.encryptWithPublicKeyHybrid(
        await module.encryption.getServerPublicKey(),
        JSON.stringify(payload)
      );
      
      const res = await fetch('https://localhost:3003/api/register/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(encryptedBody)
      });
      
      const encryptedResponse = await res.json();
      console.log('Encrypted response:', encryptedResponse);
      
      // Try to decrypt
      const decryptedText = await module.encryption.decryptWithPrivateKeyHybrid(privateKey, encryptedResponse);
      console.log('Decrypted text:', decryptedText);
      
      return { success: true, decrypted: decryptedText };
    } catch (e) {
      console.log('Error:', e);
      return { success: false, error: e.message };
    }
  });
  
  console.log('Debug result:', debugInfo);
  await browser.close();
}

testDecrypt().catch(console.error);

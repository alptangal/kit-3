// Chạy tuần tự 3 test Playwright và ghi kết quả ra file log
// Dùng khi không chạy được qua shell trực tiếp: node tests/run-all.mjs
import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

const LOG = 'tests/test-results.log';
writeFileSync(LOG, `=== TEST RUN ${new Date().toISOString()} ===\n`);

const tests = [
  'tests/login-final.mjs',
  'tests/register-final.mjs',
  'tests/forgot-password-test.mjs',
  'tests/reset-password-test.mjs',
  'tests/verify-email-test.mjs'
];

function runOne(test) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [test], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });
    let out = '';
    child.stdout.on('data', (d) => {
      const text = d.toString();
      out += text;
      appendFileSync(LOG, text);
    });
    child.stderr.on('data', (d) => {
      const text = d.toString();
      out += text;
      appendFileSync(LOG, text);
    });
    child.on('close', (code) => resolve({ test, code, out }));
    child.on('error', (err) => resolve({ test, code: -1, out: String(err) }));
  });
}

for (const t of tests) {
  console.log(`\n>>>>>> RUNNING ${t}`);
  const result = await runOne(t);
  console.log(`<<<<<< DONE ${t} (exit ${result.code})`);
}

console.log(`\nAll tests finished. Log: ${LOG}`);

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  page.on('requestfailed', r => failures.push(r.url() + ' -> ' + (r.failure()?.errorText || 'unknown')));
  page.on('response', r => { if (r.status() >= 400) failures.push(r.url() + ' -> HTTP ' + r.status()); });

  const fileUrl = 'file://' + path.resolve(__dirname, '../dist/index.html');
  await page.goto(fileUrl);
  await page.waitForTimeout(1000);

  failures.forEach(f => console.log('Failed resource:', f));
  const ok = failures.length === 0 || failures.every(f => f.includes('fonts.googleapis.com'));
  console.log(ok ? "PASS  No unexpected failed resources (only the external font stylesheet may fail in a network-restricted sandbox) — no app logic affected" : "FAIL  Unexpected failed resources found");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();

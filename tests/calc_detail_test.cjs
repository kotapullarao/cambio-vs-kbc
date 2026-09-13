const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(__dirname, '../dist/index.html');
  await page.goto(fileUrl);
  let allPass = true;
  const report = (label, ok, detail='') => { console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?' — '+detail:''}`); allPass = allPass && ok; };

  // Reset to a known clean state: S, 48h, 0 night, 300km, 1 trip, 3 months, no options
  await page.click('.chip[data-class="S"]');
  await page.evaluate(() => {
    const set = (id,v) => { const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input')); };
    set('hours',48); set('nightHours',0); set('km',300); set('trips',1); set('months',3);
  });

  console.log("=== Trip card: initially collapsed ===");
  let detailVisible = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    return card.querySelector('.detail').style.display;
  });
  report('Start card detail hidden by default', detailVisible === 'none', `display=${detailVisible}`);

  console.log("\n=== Click 'Show calculation' on Start card ===");
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    card.querySelector('[data-toggle-trip]').click();
  });
  const startDetail = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    return { display: card.querySelector('.detail').style.display, text: card.querySelector('.detail').innerText };
  });
  report('detail now visible after click', startDetail.display === 'block');
  console.log('  Rendered detail text:\n' + startDetail.text.split('\n').map(l=>'    '+l).join('\n'));

  // Expected for Start/S/48h/300km: 2 days x28 = 56; 100km x0.41=41; next 200km x0.32=64; total 161
  report('shows "2 days" line', startDetail.text.includes('2 days'));
  report('shows day rate €28.00 arithmetic', startDetail.text.includes('28.00') && startDetail.text.includes('56.00'));
  report('shows first-100km line at 41.00', startDetail.text.includes('41.00'));
  report('shows next-200km line at 64.00', startDetail.text.includes('64.00'));
  report('shows correct grand total 161.00', startDetail.text.includes('161.00'));

  console.log("\n=== Click again to collapse ===");
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    card.querySelector('[data-toggle-trip]').click();
  });
  detailVisible = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    return card.querySelector('.detail').style.display;
  });
  report('detail collapses again on second click', detailVisible === 'none');

  console.log("\n=== Expand state persists across input-driven re-render ===");
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Bonus'));
    card.querySelector('[data-toggle-trip]').click(); // expand Bonus
  });
  // change km — triggers a full re-render
  await page.evaluate(() => { const el=document.getElementById('km'); el.value=500; el.dispatchEvent(new Event('input')); });
  const bonusStillOpen = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Bonus'));
    return card.querySelector('.detail').style.display;
  });
  report('Bonus card stays expanded after changing km (state persists across re-render)', bonusStillOpen === 'block');
  const bonusDetailAfterKmChange = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Bonus'));
    return card.querySelector('.detail').innerText;
  });
  // Bonus/S/48h/500km: 100kmx.32=32, next400kmx.30=120 -> distance €152; time still 2 days x25=50; total=202
  report('detail content updates to reflect new km (500km math)', bonusDetailAfterKmChange.includes('120.00') && bonusDetailAfterKmChange.includes('202.00'));

  console.log("\n=== Multiple cards can be expanded independently ===");
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#tripResults .result-card')];
    cards.forEach(c => {
      const isOpen = c.querySelector('.detail').style.display === 'block';
      if(!isOpen) c.querySelector('[data-toggle-trip]').click();
    });
  });
  const allOpenCount = await page.evaluate(() => [...document.querySelectorAll('#tripResults .result-card .detail')].filter(d => d.style.display==='block').length);
  const totalCardCount = await page.evaluate(() => document.querySelectorAll('#tripResults .result-card').length);
  report('all cards can be independently expanded simultaneously', allOpenCount === totalCardCount, `${allOpenCount}/${totalCardCount} open`);

  console.log("\n=== Totals card: click expands calculation with correct breakdown ===");
  await page.evaluate(() => {
    const set = (id,v) => { const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input')); };
    set('km',300); set('months',3); set('trips',1);
  });
  await page.click('.chip[data-class="S"]');
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#totalsResults .result-card')];
    const startCard = cards.find(c => c.querySelector('.plan-name b')?.textContent.includes('Cambio Start'));
    startCard.querySelector('[data-toggle-total]').click();
  });
  const totalsDetail = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#totalsResults .result-card')];
    const startCard = cards.find(c => c.querySelector('.plan-name b')?.textContent.includes('Cambio Start'));
    const detail = startCard.querySelector('.detail');
    return { display: detail.style.display, text: detail.innerText };
  });
  report('totals detail appears after click', totalsDetail.display === 'block');
  // Start, 3mo, 1 trip: monthly 4x3=12, activation 35, fixed=47; variable=161x1x3=483; total=530
  report('totals detail shows monthly 12.00', totalsDetail.text.includes('12.00'));
  report('totals detail shows activation 35.00', totalsDetail.text.includes('35.00'));
  report('totals detail shows variable 483.00', totalsDetail.text.includes('483.00'));
  report('totals detail shows grand total 530.00', totalsDetail.text.includes('530.00'));

  console.log("\n=== Totals card: click again collapses calculation ===");
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#totalsResults .result-card')];
    const startCard = cards.find(c => c.querySelector('.plan-name b')?.textContent.includes('Cambio Start'));
    startCard.querySelector('[data-toggle-total]').click();
  });
  const totalsDetailClosed = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#totalsResults .result-card')];
    const startCard = cards.find(c => c.querySelector('.plan-name b')?.textContent.includes('Cambio Start'));
    return startCard.querySelector('.detail').style.display;
  });
  report('totals detail collapses again on second click', totalsDetailClosed === 'none');

  console.log("\n=== Options included in totals detail when toggled on ===");
  await page.click('#safetyPack + .slider');
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#totalsResults .result-card')];
    const startCard = cards.find(c => c.querySelector('.plan-name b')?.textContent.includes('Cambio Start'));
    startCard.querySelector('[data-toggle-total]').click();
  });
  const withSafetyDetail = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#totalsResults .result-card')];
    const startCard = cards.find(c => c.querySelector('.plan-name b')?.textContent.includes('Cambio Start'));
    return startCard.querySelector('.detail').innerText;
  });
  report('Safety Pack line appears in fixed-cost breakdown', withSafetyDetail.includes('Safety Pack'));
  report('Safety Pack arithmetic correct (€4×3+€25=37.00)', withSafetyDetail.includes('37.00'));
  await page.click('#safetyPack + .slider'); // reset

  console.log("\n=== No crash when switching to a class where a plan becomes unavailable while expanded ===");
  let crashed = false;
  page.on('pageerror', () => { crashed = true; });
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('KBC'));
    if(card) card.querySelector('[data-toggle-trip]').click(); // expand KBC
  });
  await page.click('.chip[data-class="XL"]'); // KBC has no XL -> becomes unavailable
  await page.waitForTimeout(200);
  report('no JS crash when expanded KBC card becomes unavailable (XL)', !crashed);
  const xlKbcCard = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('KBC'));
    return card.querySelector('.unavailable') !== null;
  });
  report('KBC shows unavailable message cleanly for XL (no leftover detail junk)', xlKbcCard);

  console.log("\n" + (allPass ? "ALL CALCULATION-DETAIL TESTS PASSED ✓" : "SOME TESTS FAILED"));
  await browser.close();
  process.exit(allPass?0:1);
})();

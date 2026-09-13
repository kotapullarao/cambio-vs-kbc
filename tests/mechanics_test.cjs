const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(__dirname, '../dist/index.html');
  await page.goto(fileUrl);
  let allPass = true;
  const report = (label, ok, detail='') => { console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?' — '+detail:''}`); allPass = allPass && ok; };

  // --- Real +/- button clicks: hours lower bound (min=1) ---
  await page.evaluate(() => { const el=document.getElementById('hours'); el.value=2; el.dispatchEvent(new Event('input')); });
  await page.click('.stepper button[data-target="hours"][data-step="-1"]'); // -> 1
  await page.click('.stepper button[data-target="hours"][data-step="-1"]'); // try to go below 1
  let v = await page.$eval('#hours', el => el.value);
  report('hours stepper clamps at min=1 via real button clicks', v === '1', `got ${v}`);

  // --- Real +/- button clicks: hours upper bound (max=400) ---
  await page.evaluate(() => { const el=document.getElementById('hours'); el.value=399; el.dispatchEvent(new Event('input')); });
  await page.click('.stepper button[data-target="hours"][data-step="1"]'); // -> 400
  await page.click('.stepper button[data-target="hours"][data-step="1"]'); // try to exceed
  v = await page.$eval('#hours', el => el.value);
  report('hours stepper clamps at max=400 via real button clicks', v === '400', `got ${v}`);

  // --- km stepper real clicks: step size 25, min 0 ---
  await page.evaluate(() => { const el=document.getElementById('km'); el.value=10; el.dispatchEvent(new Event('input')); });
  await page.click('.stepper button[data-target="km"][data-step="-25"]'); // 10-25 -> clamp to 0
  v = await page.$eval('#km', el => el.value);
  report('km stepper clamps at min=0 (not negative)', v === '0', `got ${v}`);

  // --- trips stepper min=1 ---
  await page.evaluate(() => { const el=document.getElementById('trips'); el.value=1; el.dispatchEvent(new Event('input')); });
  await page.click('.stepper button[data-target="trips"][data-step="-1"]');
  v = await page.$eval('#trips', el => el.value);
  report('trips stepper clamps at min=1', v === '1', `got ${v}`);

  // --- months stepper max=24 ---
  await page.evaluate(() => { const el=document.getElementById('months'); el.value=24; el.dispatchEvent(new Event('input')); });
  await page.click('.stepper button[data-target="months"][data-step="1"]');
  v = await page.$eval('#months', el => el.value);
  report('months stepper clamps at max=24', v === '24', `got ${v}`);

  // --- class chip real click updates active state visually ---
  await page.click('.chip[data-class="L"]');
  const activeClass = await page.$eval('.chip.active', el => el.dataset.class);
  const onlyOneActive = await page.$$eval('.chip.active', els => els.length);
  report('class chip click sets exactly one active chip, correct class', activeClass === 'L' && onlyOneActive === 1, `active=${activeClass}, count=${onlyOneActive}`);

  // --- Mathematical invariant: activation fee charged ONCE regardless of months ---
  const readTotal = async (planSubstr) => {
    return await page.evaluate((sub) => {
      const cards = [...document.querySelectorAll('#totalsResults .result-card')];
      const card = cards.find(c => c.textContent.includes(sub));
      return parseFloat(card.querySelector('.price').textContent.replace('€',''));
    }, planSubstr);
  };
  await page.click('.chip[data-class="S"]');
  await page.evaluate(() => { ['hours','km','trips'].forEach((id,i)=>{ const el=document.getElementById(id); el.value=[10,50,1][i]; el.dispatchEvent(new Event('input')); }); });
  await page.evaluate(() => { const el=document.getElementById('months'); el.value=1; el.dispatchEvent(new Event('input')); });
  const total1mo = await readTotal('Cambio Start');
  await page.evaluate(() => { const el=document.getElementById('months'); el.value=2; el.dispatchEvent(new Event('input')); });
  const total2mo = await readTotal('Cambio Start');
  // total(2mo) - total(1mo) should equal exactly ONE extra month's (monthly fee + variable cost), NOT another activation fee
  const perTrip = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    return parseFloat(card.querySelector('.price').textContent.replace('€',''));
  });
  const expectedDelta = 4 /*monthly*/ + perTrip*1 /*1 trip*/;
  const actualDelta = total2mo - total1mo;
  report('activation fee (€35) charged only once across months (delta check)', Math.abs(actualDelta - expectedDelta) < 0.005, `delta=${actualDelta.toFixed(2)}, expected=${expectedDelta.toFixed(2)}`);

  // --- Mathematical invariant: variable cost scales linearly with trips ---
  await page.evaluate(() => { const el=document.getElementById('months'); el.value=1; el.dispatchEvent(new Event('input')); });
  await page.evaluate(() => { const el=document.getElementById('trips'); el.value=1; el.dispatchEvent(new Event('input')); });
  const t1 = await readTotal('Cambio Start');
  await page.evaluate(() => { const el=document.getElementById('trips'); el.value=4; el.dispatchEvent(new Event('input')); });
  const t4 = await readTotal('Cambio Start');
  const fixedPart = 4*1 + 35; // monthly*1mo + activation
  const impliedPerTrip4 = (t4 - fixedPart) / 4;
  const impliedPerTrip1 = (t1 - fixedPart) / 1;
  report('variable cost scales linearly with trips (per-trip cost consistent at 1x vs 4x)', Math.abs(impliedPerTrip4 - impliedPerTrip1) < 0.005, `1trip implies ${impliedPerTrip1.toFixed(2)}/trip, 4trips implies ${impliedPerTrip4.toFixed(2)}/trip`);

  // --- Safety Pack one-time €25 charged once regardless of months ---
  await page.evaluate(() => { const el=document.getElementById('trips'); el.value=1; el.dispatchEvent(new Event('input')); }); // reset leftover state from prior test
  await page.click('#safetyPack + .slider'); // turn ON
  await page.evaluate(() => { const el=document.getElementById('months'); el.value=1; el.dispatchEvent(new Event('input')); });
  const withSP_1mo = await readTotal('Cambio Start');
  await page.evaluate(() => { const el=document.getElementById('months'); el.value=3; el.dispatchEvent(new Event('input')); });
  const withSP_3mo = await readTotal('Cambio Start');
  // going from 1->3 months adds 2 more months of (monthly fee €4 + safety pack €4 + variable), NOT 2 more €25 admin fees
  const perTripNow = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#tripResults .result-card')].find(c => c.querySelector('.plan-name b').textContent.includes('Start'));
    return parseFloat(card.querySelector('.price').textContent.replace('€',''));
  });
  const expectedDelta2 = 2 * (4 + 4 + perTripNow*1); // 2 extra months: monthly + safetypack-monthly + 1 trip's variable cost each
  const actualDelta2 = withSP_3mo - withSP_1mo;
  report('Safety Pack €25 one-time fee NOT duplicated across months', Math.abs(actualDelta2 - expectedDelta2) < 0.01, `delta=${actualDelta2.toFixed(2)}, expected=${expectedDelta2.toFixed(2)}`);
  await page.click('#safetyPack + .slider'); // turn back OFF

  // --- Exactly one winner card in each section always present (re-verify after all this state churn) ---
  const winnerTotalsCards = await page.$$eval('#totalsResults .result-card.winner', els => els.length);
  const winnerTripCards = await page.$$eval('#tripResults .result-card.winner', els => els.length);
  report('exactly one winner card in totals after heavy state churn', winnerTotalsCards === 1, `count=${winnerTotalsCards}`);
  report('exactly one winner card in trip results after heavy state churn', winnerTripCards === 1, `count=${winnerTripCards}`);

  console.log("\n" + (allPass ? "ALL MECHANICS/INVARIANT TESTS PASSED ✓" : "SOME MECHANICS TESTS FAILED"));
  await browser.close();
  process.exit(allPass?0:1);
})();

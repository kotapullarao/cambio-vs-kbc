const { chromium } = require('playwright');
const path = require('path');

const REF_PLANS = {
  start:  { monthly:4,  activation:35, classes:{
    S:{hour:2.35,night:0.5,day:28,week:168,kmLow:0.41,kmHigh:0.32},
    M:{hour:2.95,night:0.5,day:35.5,week:213,kmLow:0.43,kmHigh:0.33},
    L:{hour:3.5,night:1,day:40,week:240,kmLow:0.45,kmHigh:0.35},
    XL:{hour:4.8,night:1,day:58,week:348,kmLow:0.51,kmHigh:0.38}}},
  bonus:  { monthly:8,  activation:35, classes:{
    S:{hour:2.10,night:0.5,day:25,week:150,kmLow:0.32,kmHigh:0.30},
    M:{hour:2.45,night:0.5,day:29.5,week:177,kmLow:0.34,kmHigh:0.32},
    L:{hour:2.8,night:1,day:32,week:192,kmLow:0.38,kmHigh:0.33},
    XL:{hour:4.1,night:1,day:49.5,week:297,kmLow:0.45,kmHigh:0.36}}},
  comfort:{ monthly:22, activation:35, classes:{
    S:{hour:1.85,night:0.5,day:22,week:132,kmLow:0.29,kmHigh:0.26},
    M:{hour:2.25,night:0.5,day:27,week:162,kmLow:0.31,kmHigh:0.27},
    L:{hour:2.50,night:1,day:29,week:174,kmLow:0.32,kmHigh:0.28},
    XL:{hour:3.3,night:1,day:40,week:240,kmLow:0.38,kmHigh:0.32}}},
  kbc:    { monthly:0,  activation:20, classes:{
    S:{hour:3.35,kmLow:0.40,kmHigh:0.31},
    M:{hour:3.95,kmLow:0.42,kmHigh:0.32},
    L:{hour:4.50,kmLow:0.44,kmHigh:0.34}}}
};
function refTimeCost(hours, nightHours, r){
  if(!r.day) return hours*r.hour; // KBC
  const night = Math.min(nightHours, hours);
  let best = Infinity;
  for(let w=0; w<=Math.ceil(hours/168)+1; w++){
    const remW = Math.max(0, hours - w*168);
    for(let d=0; d<=Math.ceil(remW/24); d++){
      const remH = Math.max(0, remW - d*24);
      const remNight = Math.min(night, remH);
      const remDay = remH - remNight;
      const c = w*r.week + d*r.day + remNight*(r.night||0) + remDay*r.hour;
      if(c < best) best = c;
    }
  }
  return best;
}
function refKmCost(km, r){ return km<=100 ? km*r.kmLow : 100*r.kmLow + (km-100)*r.kmHigh; }
function refPerTrip(planKey, cls, hours, nightHours, km, kbcIns){
  const r = REF_PLANS[planKey].classes[cls];
  if(!r) return null;
  let c = refTimeCost(hours, nightHours, r) + refKmCost(km, r);
  if(planKey==='kbc' && kbcIns) c += Math.ceil(hours/24)*5;
  return c;
}
function refTotal(planKey, cls, hours, nightHours, km, trips, months, opts){
  const p = refPerTrip(planKey, cls, hours, nightHours, km, opts.kbcIns);
  if(p===null) return null;
  const plan = REF_PLANS[planKey];
  let fixed = plan.monthly*months + plan.activation;
  if(planKey!=='kbc'){
    if(opts.safetyPack) fixed += 4*months+25;
    if(opts.partnerCard) fixed += 1*months+25;
    if(opts.digitalInvoice) fixed -= 1*months;
  }
  return fixed + p*trips*months;
}

function mulberry32(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rand = mulberry32(99887766);

async function setState(page, s){
  if(s.cls) await page.click(`.chip[data-class="${s.cls}"]`);
  const setNum = async (id, val) => {
    await page.evaluate(({id,val}) => { const el=document.getElementById(id); el.value=val; el.dispatchEvent(new Event('input')); }, {id, val});
  };
  await setNum('hours', s.hours);
  await setNum('nightHours', s.nightHours);
  await setNum('km', s.km);
  await setNum('trips', s.trips);
  await setNum('months', s.months);
  const setToggle = async (id, want) => {
    if(want === undefined) return; // leave untouched if scenario doesn't specify it
    const current = await page.isChecked('#'+id);
    if(current !== want) await page.click(`#${id} + .slider`);
  };
  await setToggle('kbcInsurance', s.kbcIns);
  await setToggle('safetyPack', s.safetyPack);
  await setToggle('partnerCard', s.partnerCard);
  await setToggle('digitalInvoice', s.digitalInvoice);
}
async function readAll(page){
  return await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#tripResults .result-card')].map(c => {
      const nameEl = c.querySelector('.plan-name b');
      const priceEl = c.querySelector('.price');
      return { plan: nameEl?nameEl.textContent.trim():null, price: priceEl?parseFloat(priceEl.textContent.replace('€','')):null };
    });
    const totals = [...document.querySelectorAll('#totalsResults .result-card')].map(c => {
      const nameEl = c.querySelector('.plan-name b');
      const priceEl = c.querySelector('.price');
      return { plan: nameEl?nameEl.textContent.trim():null, total: priceEl?parseFloat(priceEl.textContent.replace('€','')):null };
    });
    const nightHoursShown = document.getElementById('nightHours').value;
    return {cards, totals, nightHoursShown};
  });
}
function keyOf(planLabel){
  if(planLabel.includes('Start')) return 'start';
  if(planLabel.includes('Bonus')) return 'bonus';
  if(planLabel.includes('Comfort')) return 'comfort';
  return 'kbc';
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(__dirname, '../dist/index.html');
  await page.goto(fileUrl);

  let allPass = true;

  // --- Targeted checks first ---
  const check = (label, got, exp) => {
    const ok = Math.abs(got-exp) < 0.005;
    console.log(`${ok?'PASS':'FAIL'}  ${label}: got ${got.toFixed(2)}, expected ${exp.toFixed(2)}`);
    allPass = allPass && ok;
  };

  console.log("=== Targeted: 24h trip, all-night (24 night hours), Class S, Start ===");
  await setState(page, {cls:'S', hours:24, nightHours:24, km:0, trips:1, months:1});
  let {cards} = await readAll(page);
  let startCard = cards.find(c=>c.plan.includes('Start'));
  // 24h all night: day rate (28) vs 24*night(0.5)=12 -> hourly-night wins, no day block used
  check('24h all-night should beat flat day rate', startCard.price, refPerTrip('start','S',24,24,0,false));
  console.log(`  (day rate would be €28, all-night hourly is €${(24*0.5).toFixed(2)} -> optimizer should pick the cheaper one)`);

  console.log("\n=== Targeted: night hours auto-clamped to total hours ===");
  await setState(page, {hours:5, nightHours:20}); // try to set night > total
  let {nightHoursShown} = await readAll(page);
  console.log(`${nightHoursShown==='5' ? 'PASS':'FAIL'}  nightHours clamped to hours(5) when set above it: shown=${nightHoursShown}`);
  allPass = allPass && nightHoursShown==='5';

  console.log("\n=== Targeted: KBC unaffected by night hours (no night rate published) ===");
  await setState(page, {cls:'M', hours:10, nightHours:10, km:50, trips:1, months:1});
  ({cards} = await readAll(page));
  const kbcCard = cards.find(c=>c.plan.includes('KBC'));
  const kbcPlain = 10*3.95 + 50*0.42; // no night discount for KBC
  check('KBC price unaffected by night hours', kbcCard.price, kbcPlain);

  console.log("\n=== Targeted: partial night within a multi-day trip (40h, 6 night hours), Class L, Bonus ===");
  await setState(page, {cls:'L', hours:40, nightHours:6, km:0, trips:1, months:1});
  ({cards} = await readAll(page));
  const bonusCard = cards.find(c=>c.plan.includes('Bonus'));
  check('40h/6-night Bonus L matches reference optimizer', bonusCard.price, refPerTrip('bonus','L',40,6,0,false));

  console.log("\n=== RANDOM FUZZ WITH NIGHT HOURS: 200 scenarios ===");
  const classes = ['S','M','L','XL'];
  let totalChecks=0, failures=0; const failLog=[];
  for(let i=0;i<200;i++){
    const hours = 1+Math.floor(rand()*400);
    const s = {
      cls: classes[Math.floor(rand()*4)],
      hours,
      nightHours: Math.floor(rand()*(hours+1)),
      km: Math.floor(rand()*3001),
      trips: 1+Math.floor(rand()*20),
      months: 1+Math.floor(rand()*24),
      kbcIns: rand()<0.5, safetyPack: rand()<0.5, partnerCard: rand()<0.5, digitalInvoice: rand()<0.5,
    };
    await setState(page, s);
    const {cards, totals} = await readAll(page);
    for(const c of cards){
      if(c.price===null) continue;
      const key = keyOf(c.plan);
      const exp = refPerTrip(key, s.cls, s.hours, s.nightHours, s.km, s.kbcIns);
      totalChecks++;
      if(Math.abs(c.price-exp)>0.005){ failures++; failLog.push(`trip ${key} #${i} ${JSON.stringify(s)}: got ${c.price}, exp ${exp}`); }
    }
    for(const t of totals){
      const key = keyOf(t.plan);
      const exp = refTotal(key, s.cls, s.hours, s.nightHours, s.km, s.trips, s.months, s);
      totalChecks++;
      if(Math.abs(t.total-exp)>0.005){ failures++; failLog.push(`totals ${key} #${i} ${JSON.stringify(s)}: got ${t.total}, exp ${exp}`); }
    }
  }
  console.log(`Scenarios: 200, assertions: ${totalChecks}, failures: ${failures}`);
  failLog.slice(0,15).forEach(f=>console.log(' - '+f));
  allPass = allPass && failures===0;

  console.log("\n" + (allPass ? "ALL NIGHT-RATE TESTS PASSED ✓" : "NIGHT-RATE TESTS FOUND ISSUES"));
  await browser.close();
  process.exit(allPass?0:1);
})();

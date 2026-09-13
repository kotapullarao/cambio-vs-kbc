const { chromium } = require('playwright');
const path = require('path');

// ---- Independent reference implementation (hand-written from source pages, not copied from artifact) ----
const REF_PLANS = {
  start:  { monthly:4,  activation:35, classes:{
    S:{hour:2.35,day:28,week:168,kmLow:0.41,kmHigh:0.32},
    M:{hour:2.95,day:35.5,week:213,kmLow:0.43,kmHigh:0.33},
    L:{hour:3.5,day:40,week:240,kmLow:0.45,kmHigh:0.35},
    XL:{hour:4.8,day:58,week:348,kmLow:0.51,kmHigh:0.38}}},
  bonus:  { monthly:8,  activation:35, classes:{
    S:{hour:2.10,day:25,week:150,kmLow:0.32,kmHigh:0.30},
    M:{hour:2.45,day:29.5,week:177,kmLow:0.34,kmHigh:0.32},
    L:{hour:2.8,day:32,week:192,kmLow:0.38,kmHigh:0.33},
    XL:{hour:4.1,day:49.5,week:297,kmLow:0.45,kmHigh:0.36}}},
  comfort:{ monthly:22, activation:35, classes:{
    S:{hour:1.85,day:22,week:132,kmLow:0.29,kmHigh:0.26},
    M:{hour:2.25,day:27,week:162,kmLow:0.31,kmHigh:0.27},
    L:{hour:2.50,day:29,week:174,kmLow:0.32,kmHigh:0.28},
    XL:{hour:3.3,day:40,week:240,kmLow:0.38,kmHigh:0.32}}},
  kbc:    { monthly:0,  activation:20, classes:{
    S:{hour:3.35,kmLow:0.40,kmHigh:0.31},
    M:{hour:3.95,kmLow:0.42,kmHigh:0.32},
    L:{hour:4.50,kmLow:0.44,kmHigh:0.34}}}
};
function refTimeCost(hours, r){
  if(!r.day) return hours*r.hour;
  let best = Infinity;
  for(let w=0; w<=Math.ceil(hours/168)+1; w++){
    const remW = Math.max(0, hours - w*168);
    for(let d=0; d<=Math.ceil(remW/24); d++){
      const remH = Math.max(0, remW - d*24);
      const c = w*r.week + d*r.day + remH*r.hour;
      if(c < best) best = c;
    }
  }
  return best;
}
function refKmCost(km, r){ return km<=100 ? km*r.kmLow : 100*r.kmLow + (km-100)*r.kmHigh; }
function refPerTrip(planKey, cls, hours, km, kbcIns){
  const r = REF_PLANS[planKey].classes[cls];
  if(!r) return null;
  let c = refTimeCost(hours, r) + refKmCost(km, r);
  if(planKey==='kbc' && kbcIns) c += Math.ceil(hours/24)*5;
  return c;
}
function refTotal(planKey, cls, hours, km, trips, months, opts){
  const p = refPerTrip(planKey, cls, hours, km, opts.kbcIns);
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
const rand = mulberry32(20260912); // deterministic seed for reproducibility

async function setState(page, s){
  if(s.cls) await page.click(`.chip[data-class="${s.cls}"]`);
  const setNum = async (id, val) => {
    await page.evaluate(({id,val}) => { const el=document.getElementById(id); el.value=val; el.dispatchEvent(new Event('input')); }, {id, val});
  };
  await setNum('hours', s.hours);
  await setNum('km', s.km);
  await setNum('trips', s.trips);
  await setNum('months', s.months);
  const setToggle = async (id, want) => {
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
      return { plan: nameEl?nameEl.textContent.trim():null, price: priceEl?parseFloat(priceEl.textContent.replace('€','')):null, isWinner: c.classList.contains('winner') };
    });
    const totals = [...document.querySelectorAll('#totalsResults .result-card')].map(c => {
      const nameEl = c.querySelector('.plan-name b');
      const priceEl = c.querySelector('.price');
      return { plan: nameEl?nameEl.textContent.trim():null, total: priceEl?parseFloat(priceEl.textContent.replace('€','')):null, isWinner: c.classList.contains('winner') };
    });
    return {cards, totals};
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

  const N = 300;
  const classes = ['S','M','L','XL'];
  let totalChecks = 0, failures = 0;
  const failLog = [];

  for(let i=0; i<N; i++){
    const s = {
      cls: classes[Math.floor(rand()*4)],
      hours: 1 + Math.floor(rand()*400),
      km: Math.floor(rand()*3001),
      trips: 1 + Math.floor(rand()*20),
      months: 1 + Math.floor(rand()*24),
      kbcIns: rand() < 0.5,
      safetyPack: rand() < 0.5,
      partnerCard: rand() < 0.5,
      digitalInvoice: rand() < 0.5,
    };
    await setState(page, s);
    const {cards, totals} = await readAll(page);

    // check trip cards
    for(const c of cards){
      if(c.price === null) continue; // unavailable class (KBC+XL)
      const key = keyOf(c.plan);
      const exp = refPerTrip(key, s.cls, s.hours, s.km, s.kbcIns);
      totalChecks++;
      if(Math.abs(c.price - exp) > 0.005){
        failures++;
        failLog.push(`trip ${key} scenario#${i} ${JSON.stringify(s)}: got ${c.price}, expected ${exp}`);
      }
    }
    // check winner flag on trip cards
    const available = cards.filter(c=>c.price!==null);
    if(available.length){
      const minP = Math.min(...available.map(c=>c.price));
      const winners = available.filter(c=>c.isWinner);
      totalChecks++;
      if(winners.length !== 1 || Math.abs(winners[0].price - minP) > 0.005){
        failures++;
        failLog.push(`trip-winner scenario#${i} ${JSON.stringify(s)}: winners=${JSON.stringify(winners)}, min=${minP}`);
      }
    }

    // check totals
    for(const t of totals){
      const key = keyOf(t.plan);
      const exp = refTotal(key, s.cls, s.hours, s.km, s.trips, s.months, s);
      totalChecks++;
      if(Math.abs(t.total - exp) > 0.005){
        failures++;
        failLog.push(`totals ${key} scenario#${i} ${JSON.stringify(s)}: got ${t.total}, expected ${exp}`);
      }
    }
    // check totals winner flag
    if(totals.length){
      const minT = Math.min(...totals.map(t=>t.total));
      const winnersT = totals.filter(t=>t.isWinner);
      totalChecks++;
      if(winnersT.length !== 1 || Math.abs(winnersT[0].total - minT) > 0.005){
        failures++;
        failLog.push(`totals-winner scenario#${i} ${JSON.stringify(s)}: winners=${JSON.stringify(winnersT)}, min=${minT}`);
      }
    }

    // KBC + XL sanity: should never appear
    totalChecks++;
    if(s.cls === 'XL' && (cards.some(c=>c.plan && c.plan.includes('KBC') && c.price!==null) || totals.some(t=>t.plan.includes('KBC')))){
      failures++;
      failLog.push(`XL-KBC-leak scenario#${i}: KBC should not price/total for XL`);
    }
  }

  console.log(`Random scenarios run: ${N}`);
  console.log(`Total individual assertions checked: ${totalChecks}`);
  console.log(`Failures: ${failures}`);
  if(failures){
    console.log("\nFirst 20 failures:");
    failLog.slice(0,20).forEach(f=>console.log(' - '+f));
  }
  console.log(failures===0 ? "\nALL RANDOMIZED FUZZ ASSERTIONS PASSED ✓" : "\nFUZZ TEST FOUND ISSUES");

  await browser.close();
  process.exit(failures===0?0:1);
})();

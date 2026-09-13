import { timeCostBreakdown, kmCost, kbcInsuranceCost, fmt, computePerTrip, computeTotals } from './calc.js';
import { PLANS } from './pricing-data.js';

function describeTimeCost(hours, nightHours, rates) {
  const b = timeCostBreakdown(hours, nightHours, rates);
  if (b.flat) {
    return `<div class="detail-line"><span class="lbl">${hours}h × ${fmt(rates.hour)}</span><span>${fmt(b.cost)}</span></div>`;
  }
  let lines = [];
  if (b.weeks > 0) lines.push(`<div class="detail-line"><span class="lbl">${b.weeks} week${b.weeks > 1 ? 's' : ''} × ${fmt(rates.week)}</span><span>${fmt(b.weeks * rates.week)}</span></div>`);
  if (b.days > 0) lines.push(`<div class="detail-line"><span class="lbl">${b.days} day${b.days > 1 ? 's' : ''} × ${fmt(rates.day)}</span><span>${fmt(b.days * rates.day)}</span></div>`);
  if (b.nightRem > 0) lines.push(`<div class="detail-line"><span class="lbl">${b.nightRem}h night rate × ${fmt(rates.night)}</span><span>${fmt(b.nightRem * rates.night)}</span></div>`);
  if (b.dayRem > 0) lines.push(`<div class="detail-line"><span class="lbl">${b.dayRem}h hourly rate × ${fmt(rates.hour)}</span><span>${fmt(b.dayRem * rates.hour)}</span></div>`);
  if (lines.length === 0) lines.push(`<div class="detail-line"><span class="lbl">0h</span><span>€0.00</span></div>`);
  return lines.join('');
}

function describeKmCost(km, rates) {
  if (km <= 100) {
    return `<div class="detail-line"><span class="lbl">${km}km × ${fmt(rates.kmLow)}</span><span>${fmt(km * rates.kmLow)}</span></div>`;
  }
  const over = km - 100;
  return `<div class="detail-line"><span class="lbl">First 100km × ${fmt(rates.kmLow)}</span><span>${fmt(100 * rates.kmLow)}</span></div>`
    + `<div class="detail-line"><span class="lbl">Next ${over}km × ${fmt(rates.kmHigh)}</span><span>${fmt(over * rates.kmHigh)}</span></div>`;
}

function describeFixed(key, plan, months, opts) {
  let lines = [];
  lines.push(`<div class="detail-line"><span class="lbl">Monthly fee: ${fmt(plan.monthly)} × ${months}</span><span>${fmt(plan.monthly * months)}</span></div>`);
  lines.push(`<div class="detail-line"><span class="lbl">Activation (one-time)</span><span>${fmt(plan.activation)}</span></div>`);
  if (key !== 'kbc') {
    if (opts.safetyPack) lines.push(`<div class="detail-line"><span class="lbl">Safety Pack: €4×${months} + €25 one-time</span><span>${fmt(4 * months + 25)}</span></div>`);
    if (opts.partnerCard) lines.push(`<div class="detail-line"><span class="lbl">Partner card: €1×${months} + €25 one-time</span><span>${fmt(1 * months + 25)}</span></div>`);
    if (opts.digitalInvoice) lines.push(`<div class="detail-line"><span class="lbl">Digital invoice: −€1×${months}</span><span>${fmt(-1 * months)}</span></div>`);
  }
  return lines.join('');
}

export function render(state) {
  state.nightHours = Math.min(state.nightHours, state.hours);
  const nightHoursInput = document.getElementById('nightHours');
  const nightHoursRange = document.getElementById('nightHoursRange');
  nightHoursInput.max = state.hours;
  nightHoursInput.value = state.nightHours;
  if (nightHoursRange) {
    nightHoursRange.max = state.hours;
    nightHoursRange.value = state.nightHours;
  }

  document.getElementById('hoursVal').textContent = state.hours + " h";
  document.getElementById('nightHoursVal').textContent = state.nightHours + " h";
  document.getElementById('kmVal').textContent = state.km + " km";
  document.getElementById('tripsVal').textContent = state.trips;
  document.getElementById('monthsVal').textContent = state.months + (state.months === 1 ? " month" : " months");
  document.getElementById('totalsHeading').textContent = "📈 Total over " + state.months + (state.months === 1 ? " month" : " months");

  const nightPart = state.nightHours > 0 ? ` (${state.nightHours}h night)` : '';
  const tripContext = `Class ${state.cls} · ${state.hours}h${nightPart} · ${state.km}km`;
  document.getElementById('tripContext').textContent = tripContext;
  document.getElementById('totalsContext').textContent =
    `${tripContext} · ${state.trips} trip${state.trips > 1 ? 's' : ''}/month`;

  const perTrip = computePerTrip(PLANS, state.cls, { hours: state.hours, nightHours: state.nightHours, km: state.km, kbcIns: state.kbcIns });
  const availableCosts = Object.values(perTrip).filter((v) => v !== null);
  const cheapestTrip = availableCosts.length ? Math.min(...availableCosts) : null;

  const tripEl = document.getElementById('tripResults');
  tripEl.innerHTML = '';
  const tripRunnerUps = document.createElement('div');
  tripRunnerUps.className = 'runner-ups';
  const order = Object.keys(PLANS).sort((a, b) => {
    const av = perTrip[a] === null ? Infinity : perTrip[a];
    const bv = perTrip[b] === null ? Infinity : perTrip[b];
    return av - bv;
  });

  order.forEach((key) => {
    const plan = PLANS[key];
    const rates = plan.classes[state.cls];
    const div = document.createElement('div');
    const isWinner = rates && perTrip[key] === cheapestTrip;
    div.className = 'result-card' + (isWinner ? ' winner' : ' compact');
    const targetEl = isWinner ? tripEl : tripRunnerUps;

    if (!rates) {
      div.innerHTML = `
        <div class="result-top">
          <div class="plan-name"><span class="dot" style="background:${plan.color}"></span><b>${plan.label}</b></div>
        </div>
        <div class="unavailable">No ${state.cls} class available for this plan.</div>`;
      targetEl.appendChild(div);
      return;
    }

    const tCost = timeCostBreakdown(state.hours, state.nightHours, rates).cost;
    const kCost = kmCost(state.km, rates);
    const insCost = (key === 'kbc' && state.kbcIns) ? kbcInsuranceCost(state.hours) : 0;
    const total = perTrip[key];
    const deltaAbs = total - cheapestTrip;
    const deltaPct = cheapestTrip > 0 ? Math.round((deltaAbs / cheapestTrip) * 100) : 0;
    const nightNote = (key !== 'kbc' && state.nightHours > 0) ? `${state.nightHours}h @ night rate` : '';
    const isOpen = state.tripDetailsOpen;

    let detailHtml = `<div class="detail-group"><div class="detail-group-title">⏱ Time</div>${describeTimeCost(state.hours, state.nightHours, rates)}</div>`
      + `<div class="detail-group"><div class="detail-group-title">📍 Distance</div>${describeKmCost(state.km, rates)}</div>`;
    if (insCost > 0) {
      detailHtml += `<div class="detail-group"><div class="detail-group-title">🛡 Insurance</div><div class="detail-line"><span class="lbl">${Math.ceil(state.hours / 24)} × 24h period(s) × €5.00</span><span>${fmt(insCost)}</span></div></div>`;
    }
    detailHtml += `<div class="detail-total"><span>Total</span><span>${fmt(total)}</span></div>`;

    div.innerHTML = `
      <div class="card-main" data-toggle-trip="${key}" role="button" tabindex="0" aria-expanded="${isOpen}">
        <div class="result-top">
          <div class="plan-name"><span class="dot" style="background:${plan.color}"></span><b>${plan.label}</b></div>
          <span class="chevron${isOpen ? ' open' : ''}"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </div>
        ${isWinner ? '<span class="badge">★ Cheapest option</span>' : ''}
        <div class="price">${fmt(total)}</div>
        <div class="breakdown">
          <div class="stat"><span class="stat-label">Time</span><span class="stat-value">${fmt(tCost)}</span>${nightNote ? `<span class="stat-note">${nightNote}</span>` : ''}</div>
          <div class="stat"><span class="stat-label">Distance</span><span class="stat-value">${fmt(kCost)}</span></div>
          ${insCost ? `<div class="stat"><span class="stat-label">Insurance</span><span class="stat-value">${fmt(insCost)}</span></div>` : ''}
        </div>
        ${isWinner ? '' : `<div class="delta">+${fmt(deltaAbs)} <span class="delta-pct">(+${deltaPct}%)</span> vs cheapest</div>`}
      </div>
      <div class="detail" style="display:${isOpen ? 'block' : 'none'}">${detailHtml}</div>
    `;
    targetEl.appendChild(div);
    const toggleEl = div.querySelector('[data-toggle-trip]');
    const detailEl = div.querySelector('.detail');
    const toggle = () => {
      state.tripDetailsOpen = !state.tripDetailsOpen;
      render(state);
    };
    toggleEl.addEventListener('click', toggle);
    toggleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    detailEl.addEventListener('click', toggle);
  });
  if (tripRunnerUps.children.length) tripEl.appendChild(tripRunnerUps);

  const totalsResultsEl = document.getElementById('totalsResults');
  totalsResultsEl.innerHTML = '';
  const totalsRunnerUps = document.createElement('div');
  totalsRunnerUps.className = 'runner-ups';
  const totals = computeTotals(PLANS, perTrip, { months: state.months, trips: state.trips, safetyPack: state.safetyPack, partnerCard: state.partnerCard, digitalInvoice: state.digitalInvoice });
  const totalValues = Object.values(totals).map((t) => t.total);
  const cheapestTotal = totalValues.length ? Math.min(...totalValues) : null;
  const totalOrder = Object.keys(totals).sort((a, b) => totals[a].total - totals[b].total);

  totalOrder.forEach((key) => {
    const plan = PLANS[key];
    const t = totals[key];
    const isWinner = t.total === cheapestTotal;
    const isOpen = state.totalDetailsOpen;
    const deltaAbs = t.total - cheapestTotal;
    const deltaPct = cheapestTotal > 0 ? Math.round((deltaAbs / cheapestTotal) * 100) : 0;

    const fixedHtml = describeFixed(key, plan, state.months, state);
    const variableHtml = `<div class="detail-line"><span class="lbl">Per-trip ${fmt(perTrip[key])} × ${state.trips} trip${state.trips > 1 ? 's' : ''} × ${state.months} month${state.months > 1 ? 's' : ''}</span><span>${fmt(t.variable)}</span></div>`;
    const detailHtml = `<div class="detail-group"><div class="detail-group-title">💳 Fixed costs</div>${fixedHtml}</div>`
      + `<div class="detail-group"><div class="detail-group-title">🚗 Variable costs</div>${variableHtml}</div>`
      + `<div class="detail-total"><span>Total</span><span>${fmt(t.total)}</span></div>`;

    const div = document.createElement('div');
    div.className = 'result-card' + (isWinner ? ' winner' : ' compact');
    const targetEl = isWinner ? totalsResultsEl : totalsRunnerUps;
    div.innerHTML = `
      <div class="card-main" data-toggle-total="${key}" role="button" tabindex="0" aria-expanded="${isOpen}">
        <div class="result-top">
          <div class="plan-name"><span class="dot" style="background:${plan.color}"></span><b>${plan.label}</b></div>
          <span class="chevron${isOpen ? ' open' : ''}"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </div>
        ${isWinner ? '<span class="badge">★ Cheapest option</span>' : ''}
        <div class="price">${fmt(t.total)}</div>
        <div class="breakdown">
          <div class="stat"><span class="stat-label">Fixed</span><span class="stat-value">${fmt(t.fixed)}</span></div>
          <div class="stat"><span class="stat-label">Variable</span><span class="stat-value">${fmt(t.variable)}</span></div>
        </div>
        ${isWinner ? '' : `<div class="delta">+${fmt(deltaAbs)} <span class="delta-pct">(+${deltaPct}%)</span> vs cheapest</div>`}
      </div>
      <div class="detail" style="display:${isOpen ? 'block' : 'none'}">${detailHtml}</div>
    `;
    targetEl.appendChild(div);
    const toggleEl = div.querySelector('[data-toggle-total]');
    const detailEl = div.querySelector('.detail');
    const toggleTotal = () => {
      state.totalDetailsOpen = !state.totalDetailsOpen;
      render(state);
    };
    toggleEl.addEventListener('click', toggleTotal);
    toggleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTotal(); }
    });
    detailEl.addEventListener('click', toggleTotal);
  });
  if (totalsRunnerUps.children.length) totalsResultsEl.appendChild(totalsRunnerUps);

  if (totalOrder.length) {
    document.getElementById('totalsNote').innerHTML =
      `💰 Excludes Cambio's refundable deposit.`;
  }
}
export function kmCost(km, rates) {
  if (km <= 100) return km * rates.kmLow;
  return 100 * rates.kmLow + (km - 100) * rates.kmHigh;
}

export function timeCostBreakdown(hours, nightHours, rates) {
  if (!rates.day) {
    return { cost: hours * rates.hour, weeks: 0, days: 0, nightRem: 0, dayRem: hours, flat: true };
  }
  const night = Math.min(nightHours, hours);
  let best = Infinity;
  let bestCombo = { weeks: 0, days: 0, nightRem: 0, dayRem: hours };
  const maxWeeks = Math.floor(hours / (24 * 7)) + 1;
  for (let w = 0; w <= maxWeeks; w++) {
    const remAfterWeeks = Math.max(0, hours - w * 24 * 7);
    const weekCost = w * rates.week;
    if (weekCost >= best) continue;
    const maxDays = Math.ceil(remAfterWeeks / 24);
    for (let d = 0; d <= maxDays; d++) {
      const remHours = Math.max(0, remAfterWeeks - d * 24);
      const remNight = Math.min(night, remHours);
      const remDay = remHours - remNight;
      const cost = weekCost + d * rates.day + remNight * rates.night + remDay * rates.hour;
      if (cost < best) {
        best = cost;
        bestCombo = { weeks: w, days: d, nightRem: remNight, dayRem: remDay };
      }
    }
  }
  return { cost: best, ...bestCombo, flat: false };
}

export function timeCost(hours, nightHours, rates) {
  return timeCostBreakdown(hours, nightHours, rates).cost;
}

export function kbcInsuranceCost(hours) {
  return Math.ceil(hours / 24) * 5;
}

export function fmt(n) {
  return "€" + n.toFixed(2);
}

export function computePerTrip(plans, cls, { hours, nightHours, km, kbcIns }) {
  const perTrip = {};
  for (const key in plans) {
    const plan = plans[key];
    const rates = plan.classes[cls];
    if (!rates) { perTrip[key] = null; continue; }
    let cost = timeCost(hours, nightHours, rates) + kmCost(km, rates);
    if (key === 'kbc' && kbcIns) cost += kbcInsuranceCost(hours);
    perTrip[key] = cost;
  }
  return perTrip;
}

export function computeTotals(plans, perTrip, { months, trips, safetyPack, partnerCard, digitalInvoice }) {
  const isCambio = { start: true, bonus: true, comfort: true, kbc: false };
  const totals = {};
  for (const key in plans) {
    if (perTrip[key] === null) continue;
    const plan = plans[key];
    let fixed = plan.monthly * months + plan.activation;
    if (isCambio[key]) {
      if (safetyPack) fixed += 4 * months + 25;
      if (partnerCard) fixed += 1 * months + 25;
      if (digitalInvoice) fixed -= 1 * months;
    }
    const variable = perTrip[key] * trips * months;
    totals[key] = { fixed, variable, total: fixed + variable };
  }
  return totals;
}

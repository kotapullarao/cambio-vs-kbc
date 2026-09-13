import test from 'node:test';
import assert from 'node:assert/strict';
import { timeCostBreakdown, kmCost, computePerTrip, computeTotals } from '../src/calc.js';
import { PLANS } from '../src/pricing-data.js';

test('Start/S/48h/0-night: 2 days at day rate wins', () => {
  const rates = PLANS.start.classes.S;
  const b = timeCostBreakdown(48, 0, rates);
  assert.equal(b.days, 2);
  assert.equal(b.cost, 56); // 2 x 28
});

test('kmCost: tiered rate above 100km', () => {
  const rates = PLANS.start.classes.S;
  assert.equal(kmCost(300, rates), 100 * 0.41 + 200 * 0.32); // 105
});

test('Start/S/48h/300km per-trip total matches known-good figure (161.00)', () => {
  const perTrip = computePerTrip(PLANS, 'S', { hours: 48, nightHours: 0, km: 300, kbcIns: false });
  assert.equal(Math.round(perTrip.start * 100) / 100, 161);
});

test('Bonus/S/48h/500km per-trip total matches known-good figure (202.00)', () => {
  const perTrip = computePerTrip(PLANS, 'S', { hours: 48, nightHours: 0, km: 500, kbcIns: false });
  assert.equal(Math.round(perTrip.bonus * 100) / 100, 202);
});

test('KBC has no XL class', () => {
  const perTrip = computePerTrip(PLANS, 'XL', { hours: 10, nightHours: 0, km: 0, kbcIns: false });
  assert.equal(perTrip.kbc, null);
});

test('computeTotals: activation fee charged once regardless of months', () => {
  const perTrip = { start: 10, bonus: null, comfort: null, kbc: null };
  const t1 = computeTotals(PLANS, perTrip, { months: 1, trips: 1, safetyPack: false, partnerCard: false, digitalInvoice: false });
  const t2 = computeTotals(PLANS, perTrip, { months: 2, trips: 1, safetyPack: false, partnerCard: false, digitalInvoice: false });
  assert.equal(t2.start.total - t1.start.total, 4 + 10); // one more month's fee + one more month's trip cost
});

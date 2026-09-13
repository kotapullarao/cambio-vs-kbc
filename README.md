# Cambio vs KBC Mobile — Cost Calculator

A single-page calculator comparing four ways to book cambio car-sharing
vehicles in Belgium: the three Cambio membership tiers (Start, Bonus,
Comfort) versus KBC Mobile (same fleet, booked through the KBC bank app,
no subscription).

Plug in a trip's vehicle class, duration, distance, and how often you'd
use it, and see which option is cheapest — both per trip and projected
over a chosen number of months.

## Pricing sources

- Cambio: https://www.cambio.be/en-bxl/how-much-does-it-cost
- KBC Mobile: https://www.kbc.be/retail/en/products/payments/self-banking/on-your-smartphone/mobile/cambio.html

Rates are hardcoded in [`src/pricing-data.js`](src/pricing-data.js). Re-verify
against the source pages above before trusting the numbers for a real
decision — prices change.

## Development

```bash
npm install
npm run dev
```

Opens a dev server with hot reload.

## Build

```bash
npm run build
```

Produces a static production bundle in `dist/`, buildable and openable
directly via `file://` (see `vite.config.js` for why that needs a small
build-only tweak). Preview it with `npm run preview`.

## Testing

```bash
npm test
```

Runs a fast pure-logic unit test, then builds the app and runs 5
Playwright-based verification scripts against the built output — ported
from the original hand-written test suite, comparing rendered output to an
independent reference implementation of the pricing logic, plus UI
mechanics checks and a console-error sweep.

First time only, install the browser binary Playwright needs:

```bash
npx playwright install chromium
```

## Project structure

- `index.html` — Vite entry point / page shell
- `src/pricing-data.js` — hardcoded plan rates (ground truth, see Pricing sources above)
- `src/calc.js` — pure cost-calculation functions, no DOM dependency
- `src/render.js` — builds the per-trip and totals-over-time cards from state + calc.js
- `src/controls.js` — wires up the slider/stepper/chip/toggle inputs
- `src/main.js` — bootstraps app state and the initial render
- `src/styles.css` — visual styling and responsive layout
- `tests/` — unit test + Playwright verification scripts (see Testing above)

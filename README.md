# Gate — Payment Workflow Prototype

A clickable HTML prototype for the **Gate** product (ARP Digital case study).
Covers payer, merchant, and compliance seats with shared state, 14 demo scenarios, and full reset controls.

## Run

Open `index.html` directly in a browser — no server, build step, or dependencies required.

```
# Optional: serve locally
python3 -m http.server 8080
# → http://localhost:8080
```

Works over `file://` and any static host. No network requests, no external fonts, no modules.

## What's inside

| File | Purpose |
|------|---------|
| `index.html` | Single entry point (all screens, demo bar, toasts) |
| `design-system.css` | Design tokens + components (single source of truth) |
| `css/app.css` | Layout-only overrides |
| `design-system.html` | Token/component specimen page |
| `js/store.js` | State, fixtures, formatters, toasts |
| `js/scenarios.js` | 14 demo scenarios (H1 + E1–E13) |
| `js/demo-bar.js` | Demo controls (seat, scenario, step, clock, volume, split view) |
| `js/router.js` | Hash-based routing |
| `js/screens/*.js` | 5 screens (payer checkout, payer status, merchant list, merchant detail, compliance) |
| `assets/fonts/` | Self-hosted variable fonts (Readex Pro, Google Sans Flex) |

## Demo controls

- **Seat:** Payer / Merchant / Compliance — toggle between the three roles
- **Scenario:** 14 presets (H1 happy path, E1–E13 edge cases)
- **Step:** Advance/back through scenario events one at a time
- **Reset:** Returns to step 1 of the current scenario (state preserved)
- **Clock:** Advance 1 hour / 1 day for time-based scenarios
- **Volume:** 0 / 1 / 200 rows in the merchant list
- **Split view:** Side-by-side seats

## Design tokens

All colours, spacing, type, and radii live in `design-system.css` as CSS custom properties.
`css/app.css` contains layout rules only (grid, flex, positioning).

## Constraints honoured

- No `fetch()`, ES modules, or external CDNs (classic deferred scripts only)
- No colour/size tokens outside `design-system.css`
- Compliance-safe: payer and merchant never see screening results, risk scores, or internal reasons
- Real calculated values (verified against the BA spec QA table)

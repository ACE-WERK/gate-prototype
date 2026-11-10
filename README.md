# Gate — Clickable Prototype

Payment workflow prototype for the ARP Digital case study. Four product screens, a demo map, and a simulated Compliance panel.

## Live
**https://ace-werk.github.io/gate-prototype/**

## Quick start
- Open the URL. You land on the **demo map** with all 17 scenarios.
- Click **Start** on any scenario card to begin.
- **Reset** (`R`) goes back to step 1 of the current scenario.
- **Split view** shows two seats side by side.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` | Switch to Payer seat |
| `2` | Switch to Merchant seat |
| `→` | Next event / step |
| `R` | Reset to step 1 |
| `T` | Toggle Today / Proposed |
| `N` | Toggle annotations |
| `H` | Hide / show demo bar |
| `C` | Open / close Compliance panel |

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Demo map | `#/` | All 17 scenarios in 3 groups |
| S1 Payer checkout | `#/payer/checkout` | Travel Rule, address safety, instalment schedule |
| S2 Payer status | `#/payer/status` | On-chain timeline, refund flow |
| S3 Merchant payments | `#/merchant/payments` | Balance tiles, payment list, CSV export |
| S4 Payment detail | `#/merchant/payments/:id` | Transactions, ledger, events, instalments |

## Demo map

Three groups of scenario cards:

- **Everyday payments:** H1, E1, E5, E6
- **When a payment is held:** E2, E15, E3, E4, E7
- **Timing and exceptions:** E8, E9, E12, E16, E17

Each card shows the scenario name, a one-line description, the roadmap line it delivers, and a Start button.

## Compliance panel

Opens from the demo bar as **"Compliance decision (simulated)"** when a case is open. Shows the case summary, four actions (Approve, Request information, Decline and refund, Freeze), a preview of what payer and merchant will see, and the event that will be sent. Styled as demo tooling, visually distinct from the product.

## Architecture

- **No build step.** Classic deferred scripts, no ES modules, no fetch(), no CDN.
- **Statuses defined once** in `design-system.css` (tokens) and `js/derive.js` (derivation).
- **Payment status is derived** from transactions by a pure function. Screens never compute status.
- **Events carry external status only.** No internal reason, risk score, or screening result in any payload.
- **Self-hosted fonts** (variable woff2, latin subset). No external requests.

## File structure

```
index.html          — entry point, script tags
design-system.css   — tokens + components (R4)
css/app.css         — layout only (R4)
js/app.js           — bootstrap
js/router.js        — route table
js/store.js         — state, transactions, cases, ledger, events
js/fixtures.js      — demo data (illustrative)
js/derive.js        — pure status derivation (R1.1)
js/strings.js       — all display strings
js/statuses.js      — status config (Today/Proposed variants)
js/scenarios.js     — 17 scenario definitions
js/demo-bar.js      — demo bar, compliance panel, shortcuts
js/screens/
  demo-map.js       — scenario cards (3 groups)
  payer-checkout.js — S1
  payer-status.js   — S2
  merchant-payments.js — S3
  merchant-payment-detail.js — S4
assets/fonts/       — variable woff2 (latin)
docs/               — decisions, assumptions, demo script, panel notes, QA
tests/derive.html   — status derivation tests
```

## Hosting
See [docs/HOSTING.md](docs/HOSTING.md). Works on any static host. No build step. No analytics. No external requests.

## Demo script
See [docs/demo-script.md](docs/demo-script.md) — 12-minute walkthrough.
